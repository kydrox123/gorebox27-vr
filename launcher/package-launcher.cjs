const {packager} = require('@electron/packager');
const path = require('node:path');
packager({dir:__dirname,name:'GoreBox VR Launcher',platform:'win32',arch:'x64',out:path.join(__dirname,'../packaged'),overwrite:true,asar:false,ignore:[/^\/node_modules(?:\/|$)/,/brand\.png$/, /package-launcher\.cjs$/],icon:path.join(__dirname,'art/launcher.ico')}).then(console.log, error => {console.error(error);process.exitCode=1});


