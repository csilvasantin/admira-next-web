(function (G) {
  'use strict';
  // Playlists de los Xpacios, en el orden que pidió Carlos (encargo 7273).
  // La casa del mapa tiene cinco salas, en ese mismo orden.
  var XPACIOS = [
    {id:'pixeria',name:'Pixería',address:'Aulèstia i Pijoan 21',tag:'creatividad'},
    {id:'university',name:'Admira University',address:'Bretón de los Herreros 9',tag:'negocio'},
    {id:'garage',name:'El Garage',address:'Santa Rosa 4',tag:'devops'},
    {id:'sneaker-store',name:'Sneaker Store',address:'Santa Rosa 19',tag:'retail'},
    {id:'la-nave',name:'La Nave',address:'Planeta 7',tag:'tecnologia'}
  ];
  var SALAS = ['cocina','terraza','pasillo','sneaker-store','la-nave'];
  function copy(xp) {return xp?{id:xp.id,name:xp.name,address:xp.address,tag:xp.tag}:null;}
  function playlistAt(index) {
    return copy(XPACIOS[index] || null);
  }
  function playlistFor(id) {
    var index = SALAS.indexOf(id);
    return index < 0 ? null : playlistAt(index);
  }
  function assign(roomIds) {
    var ids = Array.isArray(roomIds) ? roomIds : SALAS;
    return ids.map(function (id, index) {return {sala:id,xpacio:playlistAt(index)};});
  }
  G.AdmiraSalasReales = {
    playlistFor:playlistFor,
    playlistAt:playlistAt,
    assign:assign,
    xpacios:XPACIOS.map(copy),
    salas:SALAS.slice(),
    // Id del Xpacio cuya playlist suena en esa sala. No es un número de player físico.
    playerFor:function (id) {var xp=playlistFor(id);return xp?xp.id:null;}
  };
})(typeof window !== 'undefined' ? window : globalThis);
