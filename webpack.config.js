var path = require('path');

// var target = __dirname;
var target = "C:\\Users\\Matt\\AppData\\Local\\Screeps\\scripts\\screeps.com\\default";

module.exports = [
    {
        context: path.join(__dirname, 'src'),
        entry: "./main",
        output: {
            path: target,
            filename: "main.js",
            libraryTarget: "commonjs2"
        },
        resolve: {
            extensions: [".ts", ".js", ".json"]
        },
        module: {
            rules: [
                { test: /\.ts$/, use: { loader: 'awesome-typescript-loader' } }
            ]
        }
    }
];