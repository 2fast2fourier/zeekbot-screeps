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
    // {
    //     context: path.join(__dirname, 'src'),
    //     entry: "./main",
    //     output: {
    //         path: "C:\\Users\\Matt\\AppData\\Local\\Screeps\\scripts\\screeps.com\\default",
    //         filename: "main.js",
    //         libraryTarget: "commonjs2"
    //     }
    // },
    // {
    //     context: path.join(__dirname, 'src'),
    //     entry: "./main",
    //     output: {
    //         path: "C:\\Users\\Matt\\AppData\\Local\\Screeps\\scripts\\127_0_0_1___21025\\default",
    //         filename: "main.js",
    //         libraryTarget: "commonjs2"
    //     }
    // },
    // {
    //     context: path.join(__dirname, 'src'),
    //     entry: "./main",
    //     output: {
    //         path: "C:\\Users\\Matt\\AppData\\Local\\Screeps\\scripts\\vmi105797_contabo_host___21025\\default",
    //         filename: "main.js",
    //         libraryTarget: "commonjs2"
    //     }
    // }
];