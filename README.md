# node-jupyter-runner
Nodejs service to connect to a Jupyter instance and execute Javascript notebooks

# Installation

Intended to be included by and called from `docker-jupyter-nodejs` using:

* `node server.js`

# Usage

Runs IJavascript notebooks and return the final exposed object as JSON by performing a GET HTTP call.

* `http://127.0.0.1:8889/exec/<notebookname>?<parameter1>=<value>&<parameter2>=<value>&...etc`
* `http://127.0.0.1:8889/exec/JsonPlaceHolderTest1?testPostId=3&testExtraText=Random%20Text`

Parameters can be read from the `arguments` object, like `arguments.parameter1`. The `arguments` object may be empty or undefined.

To use asynchronous calls in a cell, first invoke `$$.async();` like explained in the [Asynchronous output](https://n-riesco.github.io/ijavascript/doc/async.ipynb.html) documentation of IJavascript.

# Security

A `_keys.json` file can be defined at the root of your Jupyter instance to limit the notebooks users can run based the value of the key argument provided in the GET call.

* `http://127.0.0.1:8889/exec/JsonPlaceHolderTest1?testPostId=3&testExtraText=Random%20Text&key=473a8c56-55da-4eec-8269-d0e9de1c374d`

Example `_keys.json` file:

```json
[
    { "key": "473a8c56-55da-4eec-8269-d0e9de1c374d", "name": "Administrator", "permissions": [""] },
    { "key": "5e3a4069-4fec-4ed5-9965-7c6da096cc71", "name": "Test 1 - Specific notebooks", "permissions": ["JsonPlaceHolderTest1", "JsonPlaceHolderTest2"] },
    { "key": "ba0fc7ad-26eb-44bf-9e8c-f1fb5ad1def7", "name": "Test 2 - Specific notebooks", "permissions": ["JsonPlaceHolderTest2", "SubFolder/FirstTest", "SubFolder/SecondaryTest"] },
    { "key": "ba0fc7ad-26eb-44bf-9e8c-f1fb5ad1def7", "name": "Test 3 - Subfolders", "permissions": ["SubFolder/"] }
]
```

Structure:

* `key` - Key of any length.
* `name` - Name of the key, or who it is assigned to (optional).
* `permissions` - Array of notebooks the key grants access to. Can target notebooks in subfolders. To grant access to multiple files, either list them individually or place them in a subfolder and use the name of the subfolder to assign permissions. Names are case insensitive. Use `""` to indicate the user can access all notebooks.

# Internals

When calling the `/exec/` route for a named IJavascript notebook, node-jupyter-runner will use the Jupyter API to fetch the content of this notebook. Any cell where `"cell_type"="code"` is pushed through javascript's **eval** function and its output is stored and in scope of the next step.