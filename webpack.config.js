var path = require('path');

module.exports = [
    {
        context: path.join(__dirname, 'src'),
        entry: "./main",
        output: {
            path: __dirname,
            filename: "main.js",
            libraryTarget: "commonjs2"
        }
    },
    {
        context: path.join(__dirname, 'src'),
        entry: "./main",
        output: {
            path: "C:\\Users\\Matt\\AppData\\Local\\Screeps\\scripts\\screeps.com\\default",
            filename: "main.js",
            libraryTarget: "commonjs2"
        }
    }
];