// http://localhost:8080/exec/Newspaper-AD?fromDate=2021-07-01&searchString=Roelofarendsveen
// http://localhost:8080/exec/Newspaper-LeidschDagblad?fromDate=2021-07-01&searchString=Roelofarendsveen

// Modules used by server
const http = require("http");
const urlparser = require("url");
const fetch = require("node-fetch");
const colors = require("colors");
const { exec } = require('child_process');

// Modules used by notebooks
const parse = require("node-html-parser").parse;

const requestListener = async function (req, res) {
	res.writeHead(200, {"Content-Type": "application/json"});

	var link = urlparser.parse(req.url);
	var parameters = new URLSearchParams(link.search);

	// Display request details
	if (link.pathname.startsWith("/exec/"))
	{
		console.log(`Notebook: ${link.pathname}`);
		console.log(`Parameters:`);
		
		Array.from(parameters.keys()).map(function (key)
		{
			console.log(`- ${key}: ${parameters.get(key)}`);
		});
		
		// Pull notebook from Jupyter using API
		
		var notebook = await getNotebook(link.pathname.split("/")[2]);
		var steps = prepareNotebook(notebook);
		
		// Set variables
		
		Array.from(parameters.keys()).map(function (key)
		{
			global[key] = parameters.get(key);
		});
		
		// Execute notebook and capture output
		
		var output = await executeNotebook(steps);
		
		res.write(JSON.stringify(output, null, 2));
	}
	
	res.end();
}

const server = http.createServer(requestListener);
server.listen(8889);

async function getNotebook(notebookName)
{
    /*
    // Get token from Jupyter Lab in order to authenticate to API
    const { stdout, stderr } = await exec("jupyter lab list");
    var tokenString = "";
    for await (const stdoutString of stdout) {
        tokenString += stdoutString;
    };
    var token = tokenString.match(/token=([a-z0-9]+)/)[1];
    */
    // Get notebook
    //var response = await fetch(`http://127.0.0.1:8888/api/contents/${notebookName}.ipynb?token=${token}`);
	try
	{
		var response = await fetch(`http://127.0.0.1:8888/api/contents/${notebookName}.ipynb`);
		var body = await response.text();
		return JSON.parse(body);
	}
	catch(e)
	{
		console.log(`Error while fetching notebook:`, e);
		return {error: e};
	}
}

function prepareNotebook(notebook)
{
	try
	{
		return notebook.content.cells.filter(cell => cell.cell_type == "code").map(cell => cell.source);
	}
	catch(e)
	{
		console.log(`Error while preparing notebook:`, e);
		return {error: e};
	}
}

async function executeNotebook(steps)
{
	
	// $$ variable is part of IJavascript. Capture calls to $$.async and $$.done to halt execution of next step until script is resolved.
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
		}
	};
	
	// Expose variables
	//var searchString = "Roelofarendsveen";
	//var fromDate = "2021-07-01";
	
	// Loop over steps
	var i = 1;
	
	try
	{
		for (var step of steps)
		{
			console.log(`=== Step #${i} ===`.green);
			//console.log(step.gray);
			console.log("Results:".red, await eval(step));
			await $$.isDone();
			i++;
		};
	}
	catch(e)
	{
		console.log(`Error while executing notebook on step ${i}:`, e);
		return {error: e};
	}
	
	// Return data from the articles array
	return articles;
	
}