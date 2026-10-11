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
}

@MainActor final class Visor: ObservableObject {
    @Published var items: [Piece] = []
    @Published var index = 0
    @Published var image: UIImage?
    @Published var player: AVPlayer?
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
                  let link = config["VisorURL"] as? String, let url = URL(string: link), url.scheme == "https" else {
                throw VisorError.configuration
            }
            base = URL(string: url.scheme! + "://" + url.host!)
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
        guard url.scheme == "https", url.host == base?.host else { throw VisorError.configuration }
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
    var body: some View {
        VStack(spacing: 3) {
            HStack {
                Text("ADMIRA VISOR").font(.system(size: 10, weight: .semibold))
                Spacer()
                Text(visor.items.isEmpty ? "—" : "\(visor.index + 1)/\(visor.items.count)")
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .accessibilityIdentifier("playlistPosition")
            }.foregroundStyle(.mint)
            ZStack {
                Color.black
                if let image = visor.image {
                    Image(uiImage: image).resizable().scaledToFit()
                }
                if let player = visor.player, !dimmed { VideoPlayer(player: player) }
                if !visor.message.isEmpty {
                    VStack(spacing: 5) {
                        Text(visor.message).font(.caption2).multilineTextAlignment(.center)
                        if !visor.playing {
                            Button("Reintentar") { Task { await visor.retry() } }.font(.caption2)
                        }
                    }
                }
                if dimmed { Text("Admira Visor").font(.caption2).foregroundStyle(.secondary) }
            }.clipped()
            if !visor.items.isEmpty {
                Text(visor.items[visor.index].title).font(.system(size: 10)).lineLimit(1)
            }
        }
        .padding(.horizontal, 5)
        .background(.black)
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
