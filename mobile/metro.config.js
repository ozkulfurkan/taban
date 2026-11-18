// Kök dizindeki saf hesap modülleri (../lib: para, ekstre satırları, çek vadesi, kur)
// web ve mobil uygulamada ortak kullanılır.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../lib')];
module.exports = config;
