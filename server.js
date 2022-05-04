// Modules used by server
const http = require("http");
const urlparser = require("url");
const fetch = require("node-fetch");
const colors = require("colors");
const { exec } = require("child_process");

// Modules used by notebooks
const parse = require("node-html-parser").parse;

const requestListener = async function(req, res) {
    res.writeHead(200, { "Content-Type": "application/json" });

    var link = urlparser.parse(req.url);
    var link_parameters = new URLSearchParams(link.search);

    // Display request details
    if (link.pathname.startsWith("/exec/")) {

        console.log(`Notebook: ${link.pathname}`);
        console.log(`Parameters:`);

        var notebookName = link.pathname.split("/exec/")[1];

        var parameters = {};
        Array.from(link_parameters.keys()).map(function(key) {
            console.log(`- ${key}: ${link_parameters.get(key)}`);
            parameters[key] = link_parameters.get(key);
        });

        var output = {};

        // Verify permissions

        var permission = await checkPermission(notebookName, parameters.key)

        if (permission.access) {

            // Pull notebook from Jupyter using API

            var notebook = await getNotebook(notebookName);
            var steps = prepareNotebook(notebook);

            // Execute notebook and capture output

            output = await executeNotebook(steps, parameters);

        } else {

            // No permissions
            output = permission.error;

        }

        // Export output

        if (typeof(output) == "object") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.write(JSON.stringify(output, null, 2));
        } else {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.write(output);
        }
    }

    res.end();
}

const server = http.createServer(requestListener);
server.listen(8889);

async function checkPermission(notebookName, key) {
    try {
        // Download keys
        var response = await fetch(`http://localhost:8888/api/contents/_keys.json?token=${process.env.JUPYTER_TOKEN}`);
        if (response.status == 404) {
            // When the file does not exist, do not apply security
            return { "access": true }
        } else {
            // File exists, check key
            var json = await response.json();
            try {
                var keys = JSON.parse(json.content);
            } catch (e) {
                return { "access": false, "error": `Error in keys definition: ${e}` }
            }
            if (keys.length == 0 || keys.some(k => k.key == key && k.permissions.some(p => notebookName.toLowerCase().startsWith(p.toLowerCase())))) {
                return { "access": true }
            } else {
                return { "access": false, "error": `Bad key or no permission to selected notebook.` };
            }
        }
    } catch (e) {
        return { "access": false, "error": `Error fetching keys: ${e}` };
    }
}

async function getNotebook(notebookName) {
    // Get notebook
    try {
        var response = await fetch(`http://localhost:8888/api/contents/${notebookName}.ipynb?token=${process.env.JUPYTER_TOKEN}`);
        var body = await response.text();
        return JSON.parse(body);
    } catch (e) {
        console.log(`Error while fetching notebook:`, e);
        return { error: e };
    }
}

function prepareNotebook(notebook) {
    try {
        return notebook.content.cells.filter(cell => cell.cell_type == "code").map(cell => cell.source);
    } catch (e) {
        console.log(`Error while preparing notebook:`, e);
        return { error: e };
    }
}

async function executeNotebook(steps, parameters) {

    // $$ is part of IJavascript. Capture calls to $$.async and $$.done to halt execution of next step until script is resolved.
    var $$ = {
        // Public
        "async": function() {
            // Called from the notebook; register isAsync is now ON
            this.isAsync = true;
        },
        "done": function() {
            // Called from the notebook; register isAsync is now OFF
            this.isAsync = false;
        },
        // Internal
        "isAsync": false,
        "isDone": function() {
            // Wait for isAsync to turn OFF, then continue
            return new Promise(function(resolve, reject) {
                setInterval(function() {
                    if ($$.isAsync == false) {
                        resolve(true);
                    }
                }, 100);
            });
        },
        // Passthrough for IJavascript functions
        "mime": function(data) {
            return Object.values(data)[0];
        }
    };

    // Assign variables into global
    Object.keys(parameters).forEach(parameter => global[parameter] = parameters[parameter]);

    // Loop over steps
    var i = 1;
    var lastOutput;

    try {
        for (var step of steps) {
            //console.log(`=== Step #${i} ===`.green);
            //console.log(step.gray);
            var tempOutput = await eval(step);
            if (tempOutput) {
                lastOutput = tempOutput;
            }
            //console.log("Results:".red, tempOutput);
            await $$.isDone();
            i++;
        };
    } catch (e) {
        console.log(`Error while executing notebook on step ${i}:`, e);
        return { error: e };
    }

    // Return data
    return lastOutput;

}