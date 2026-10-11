import SwiftUI
import AVKit
import AVFoundation
import WatchKit
import OSLog
import CryptoKit

private let log = Logger(subsystem: "com.admiranext.visor.watch", category: "playlist")

struct Playlist: Decodable {
    let screen: String
    let items: [Piece]
}
struct Piece: Decodable, Identifiable {
    let id: String
    let title: String
    let type: String
    let seconds: Double
    let url: String
    let poster: String?

    var displayTitle: String {
        // This phase-A clip's catalog label is still the placeholder "Clip 5s".
        // Name its actual subject locally; keep every other catalog title intact.
        if id == "1790352875323-h4x25z", title == "Clip 5s" {
            return "Modelo de pantalla · envío"
        }
        return title
    }
}

@MainActor final class Visor: ObservableObject {
    @Published var items: [Piece] = []
    @Published var index = 0
    @Published var image: UIImage?
    @Published var player: AVPlayer?
    @Published var videoSize = CGSize(width: 16, height: 9)
    @Published var message = "Conectando…"
    @Published var playing = false
    private let session: URLSession
    private var base: URL?
    private var rotation: Task<Void, Never>?
    private var generation = UUID()
    private var loopObserver: NSObjectProtocol?
    private var videoObservation: NSKeyValueObservation?
    private var videoFile: URL?
    private var foreground = true
    private var loading = false

    init() {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpShouldSetCookies = true
        configuration.timeoutIntervalForRequest = 25
        configuration.urlCache = URLCache(memoryCapacity: 8 * 1024 * 1024, diskCapacity: 20 * 1024 * 1024)
        session = URLSession(configuration: configuration)
    }

    func start() async {
        guard !playing, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            guard let path = Bundle.main.url(forResource: "Device", withExtension: "plist"),
                  let data = try? Data(contentsOf: path),
                  let config = try PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any],
                  let link = config["VisorURL"] as? String, let url = URL(string: link),
                  url.scheme == "https", url.host != nil, url.user == nil, url.password == nil,
                  var origin = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
                throw VisorError.configuration
            }
            origin.path = ""
            origin.query = nil
            origin.fragment = nil
            base = origin.url
            let fingerprint = SHA256.hash(data: Data(link.utf8)).map { String(format: "%02x", $0) }.joined()
            if UserDefaults.standard.string(forKey: "visorLinkFingerprint") != fingerprint {
                for cookie in HTTPCookieStorage.shared.cookies ?? [] where cookie.name == "admira_visor" && cookie.domain == url.host {
                    HTTPCookieStorage.shared.deleteCookie(cookie)
                }
                UserDefaults.standard.set(fingerprint, forKey: "visorLinkFingerprint")
            }
            // Bootstrap the existing one-device cookie, then bind it before loading media.
            _ = try await read(url)
            let playlistURL = URL(string: "/pruebas/visor/watch-playlist", relativeTo: base)!.absoluteURL
            let playlist = try JSONDecoder().decode(Playlist.self, from: await read(playlistURL))
            guard !playlist.items.isEmpty else { throw VisorError.empty }
            guard foreground, !Task.isCancelled else { return }
            items = playlist.items
            playing = true
            message = ""
            log.info("Playlist cargada: \(playlist.items.count) piezas")
            beginRotation()
        } catch {
            message = readable(error)
            playing = false
            let failure = error as NSError
            log.error("Carga fallida: dominio \(failure.domain, privacy: .public), código \(failure.code)")
        }
    }

    private func read(_ url: URL) async throws -> Data {
        guard url.scheme == "https", url.host == base?.host, url.port == base?.port else { throw VisorError.configuration }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse else { throw VisorError.network }
        log.info("HTTP \(http.statusCode): \(url.path, privacy: .public)")
        if [401, 403].contains(http.statusCode) { throw VisorError.expired }
        guard http.statusCode == 200 else { throw VisorError.network }
        return data
    }

    private func beginRotation() {
        rotation?.cancel()
        rotation = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled && self.playing {
                let piece = self.items[self.index]
                await self.show(piece)
                guard !Task.isCancelled else { break }
                do { try await Task.sleep(for: .seconds(max(2, min(600, piece.seconds)))) }
                catch { break }
                guard !Task.isCancelled else { break }
                self.index = (self.index + 1) % self.items.count
            }
        }
    }

    private func stopMedia() {
        generation = UUID()
        player?.pause()
        player = nil
        videoObservation = nil
        if let loopObserver { NotificationCenter.default.removeObserver(loopObserver) }
        loopObserver = nil
        if let videoFile { try? FileManager.default.removeItem(at: videoFile) }
        videoFile = nil
        image = nil
        videoSize = CGSize(width: 16, height: 9)
    }

    private func show(_ piece: Piece) async {
        stopMedia()
        let currentGeneration = generation
        message = "Cargando…"
        log.info("Mostrando \(self.index + 1)/\(self.items.count): \(piece.type, privacy: .public)")
        do {
            guard let url = URL(string: piece.url, relativeTo: base)?.absoluteURL else { throw VisorError.configuration }
            let data = try await read(url)
            guard !Task.isCancelled, currentGeneration == generation else { return }
            if piece.type == "video" {
                // Download through the authenticated URLSession; AVPlayer receives a local file.
                let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".mp4")
                try data.write(to: file, options: .atomic)
                videoFile = file
                let item = AVPlayerItem(url: file)
                let asset = AVURLAsset(url: file)
                var mediaSize = CGSize(width: 16, height: 9)
                if let tracks = try? await asset.loadTracks(withMediaType: .video),
                   let track = tracks.first,
                   let size = try? await track.load(.naturalSize),
                   let transform = try? await track.load(.preferredTransform) {
                    let transformed = size.applying(transform)
                    if abs(transformed.width) > 0, abs(transformed.height) > 0 {
                        mediaSize = CGSize(width: abs(transformed.width), height: abs(transformed.height))
                    }
                }
                guard !Task.isCancelled, currentGeneration == generation else { return }
                videoSize = mediaSize
                let av = AVPlayer(playerItem: item)
                av.isMuted = true
                av.actionAtItemEnd = .none
                player = av
                loopObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main) { [weak av] _ in
                    Task { @MainActor in av?.seek(to: .zero); av?.play() }
                }
                videoObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
                    if item.status == .failed {
                        Task { @MainActor in
                            guard let self, currentGeneration == self.generation else { return }
                            self.message = "Póster del vídeo"
                            self.player?.pause()
                            self.player = nil
                            await self.loadPoster(piece, generation: currentGeneration)
                        }
                    }
                }
                av.play()
            } else {
                guard let decoded = UIImage(data: data) else { throw VisorError.network }
                image = decoded
            }
            message = ""
        } catch {
            guard !Task.isCancelled, currentGeneration == generation else { return }
            message = readable(error)
            if piece.type == "video" { await loadPoster(piece, generation: currentGeneration) }
        }
    }

    private func loadPoster(_ piece: Piece, generation expected: UUID) async {
        guard let path = piece.poster, let url = URL(string: path, relativeTo: base)?.absoluteURL else { return }
        if let data = try? await read(url), expected == generation, !Task.isCancelled {
            image = UIImage(data: data)
            if image != nil { message = "Póster del vídeo" }
        }
    }

    func pause() {
        foreground = false
        playing = false
        rotation?.cancel()
        rotation = nil
        stopMedia()
    }
    func resume() async {
        foreground = true
        if items.isEmpty { await start() }
        else if !playing { playing = true; beginRotation() }
    }
    func retry() async { pause(); foreground = true; items = []; index = 0; await start() }
    private func readable(_ error: Error) -> String {
        switch error {
        case VisorError.configuration: return "Falta el enlace del visor"
        case VisorError.expired: return "Enlace caducado o revocado"
        case VisorError.empty: return "Playlist vacía"
        default: return "Sin conexión · reintentar"
        }
    }
    enum VisorError: Error { case configuration, expired, empty, network }
}

struct VisorView: View {
    @StateObject private var visor = Visor()
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.isLuminanceReduced) private var dimmed
    private let admiraGreen = Color(red: 0x33 / 255.0, green: 1, blue: 0x99 / 255.0)

    private func fittedSize(_ media: CGSize, in available: CGSize) -> CGSize {
        guard media.width > 0, media.height > 0 else { return available }
        let scale = min(available.width / media.width, available.height / media.height)
        return CGSize(width: media.width * scale, height: media.height * scale)
    }

    private var currentTitle: String? {
        guard visor.items.indices.contains(visor.index) else { return nil }
        return visor.items[visor.index].displayTitle
    }

    private func titleOverlay(width: CGFloat) -> some View {
        ZStack(alignment: .bottomLeading) {
            LinearGradient(colors: [.clear, .black.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            if let title = currentTitle {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .padding(.horizontal, 10)
                    .padding(.bottom, 8)
                    .accessibilityIdentifier("pieceTitle")
            }
        }
        .frame(width: width, height: 48)
        .allowsHitTesting(false)
    }

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text("ADMIRA VISOR").font(.system(size: 10, weight: .semibold))
                Spacer()
                Text(visor.items.isEmpty ? "—" : "\(visor.index + 1)/\(visor.items.count)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .accessibilityIdentifier("playlistPosition")
            }
            .foregroundStyle(admiraGreen)
            .padding(.horizontal, 10)
            .frame(height: 14)
            GeometryReader { geometry in
                ZStack {
                    Color.black
                    if let image = visor.image {
                        let size = fittedSize(image.size, in: geometry.size)
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(width: size.width, height: size.height)
                            .overlay(alignment: .bottom) { titleOverlay(width: size.width) }
                    }
                    if let player = visor.player, !dimmed {
                        // The video surface spans the width. Keep portrait clips
                        // intact at full height, with black bars inside the surface.
                        let size = fittedSize(visor.videoSize, in: geometry.size)
                        VideoPlayer(player: player)
                            .frame(width: geometry.size.width, height: size.height)
                            .background(.black)
                            .disabled(true)
                            .allowsHitTesting(false)
                            .overlay(alignment: .bottom) { titleOverlay(width: geometry.size.width) }
                    }
                    if !visor.message.isEmpty {
                        VStack(spacing: 5) {
                            Text(visor.message).font(.caption2).multilineTextAlignment(.center)
                            if !visor.playing {
                                Button("Reintentar") { Task { await visor.retry() } }.font(.caption2)
                            }
                        }
                        .padding(.horizontal, 10)
                    }
                    if dimmed { Text("Admira Visor").font(.caption2).foregroundStyle(.secondary) }
                }
                .frame(width: geometry.size.width, height: geometry.size.height)
                .clipped()
            }
        }
        // Reserve only the system clock; reclaim watchOS's large content margins.
        .padding(.top, 35)
        .background(.black)
        .ignoresSafeArea()
        .task { await visor.start() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await visor.resume() } }
            else { visor.pause() }
        }
        .onChange(of: dimmed) { _, reduced in
            if reduced { visor.pause() }
            else if scenePhase == .active { Task { await visor.resume() } }
        }
    }
}
@main struct AdmiraVisorApp: App {
    var body: some Scene { WindowGroup { VisorView() } }
}
