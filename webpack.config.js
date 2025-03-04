const path = require("path");
const fs = require("fs");
const CopyWebpackPlugin = require("copy-webpack-plugin");

// Webpack entry points. Mapping from resulting bundle name to the source file entry.
const entries = {};

// Loop through subfolders in the "src" folder and add an entry for each one
const srcDir = path.join(__dirname, "src");
fs.readdirSync(srcDir).filter(dir => {
    if (fs.statSync(path.join(srcDir, dir)).isDirectory()) {
        entries[dir] = "./" + path.relative(process.cwd(), path.join(srcDir, dir, dir));
    }
});

module.exports = (env, argv) => ({
    entry: "./src/Hub.tsx",
    output: {
        filename: "hub.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
        alias: {
            "azure-devops-extension-sdk": path.resolve("node_modules/azure-devops-extension-sdk")
        },
    },
    stats: {
        warnings: false
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: "ts-loader"
            },
            {
                test: /\.scss$/,
                use: ["style-loader", "css-loader", "sass-loader"],
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            }
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [ 
                { from: "**/*.html", context: "src" }
            ]
         })
    ],
});