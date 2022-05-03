# node-jupyter-runner
Nodejs service to connect to a Jupyter instance and execute Javascript notebooks

# Installation

Intended to be included by and called from `docker-jupyter-nodejs` using:

`node server.js`

# Usage

Run IJavascript notebooks and return the final exposed object as JSON.

* `http://127.0.0.1:8889/exec/<notebookname>?<parameter1>=<value>&<parameter2>=<value>&...etc`
* `http://127.0.0.1:8889/exec/JsonPlaceHolderTest1?testPostId=3&testExtraText=Random%20Text`

Parameters can be read from the `arguments` object, like `arguments.parameter1`. The `arguments` object may be empty or undefined.

To use asynchronous calls in a cell, first invoke `$$.async();` like explained in the [Asynchronous output](https://n-riesco.github.io/ijavascript/doc/async.ipynb.html) documentation of IJavascript.

# Internals

When calling the `/exec/` route for a named IJavascript notebook, node-jupyter-runner will use the Jupyter API to fetch the content of this notebook. Any cell where `"cell_type"="code"` is pushed through javascript's **eval** function and its output is stored and in scope of the next step.