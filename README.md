Torrent Creator
=============

Torrent creation module for FireBit that can be ran as a separate extension.

###Run torrent creator as an addon

```code
git clone git@github.com:DecipherCode/torrent-creator.git torrent-creator
cd torrent-creator
cfx run // use cfx xpi to create torrent-creator.xpi package.
```

Module Installation
------------

There must be a _packages_ directory located at the root of your add-on's package. This package should be stored in the package's directory.

### Directory Structure

```code
Relative: /packages/torrent-creator

 someaddon.xpi

    /packages

        /torrent-creator

            /lib

                /...

        /anotherpackage

            /...

    /lib

        /main.js

    /data

        /...

```

### Modify "package.json"

You will need to list _torrent-creator_ as a dependency. Below is an example addon's package.json.

```json
{
    "license": "MPL 2.0",
    "version": "1.0",
    "description": "Some Addon",
    "contributors": [],
    "keywords": [ "some addon extension" ],
    "author": "Author Name <author@site.com",
    "homepage": "https://someaddon.org",
    "repository": {
        "type": "git",
        "url": "https://github.com/author/someaddon.git",
        "web": "https://github.com/author/someaddon"
    },
    "bugs": "https://github.com/author/someaddon/issues",
    "dependencies": ["apiutils", "addonkit", "torrent-creator"],
    "packages": "packages",
    "version": "1.0",
    "lib": "lib",
    "fullName": "Some Addon",
    "main": "main",
    "id": "someaddon@site.com",
    "name": "someaddon"
}
```

###Require Library

```javascript
/*
 *  @Summary:
 *      Creates a torrent object given a url, file, or stream.
 *
 *  @Syntax:
 *      createTorrent(options);
 *
 *  @Optional-Syntax:
 *      createTorrent(source).then(resolve, reject);
 *
 *  @Param: 
 *      options - An Object that may contain the following properties:
 *      {
 *          source: String URL, nsIURI, nsIFile, or nsIInputStream,
 *          torrent: Torrent Object to reuse if any.
 *          prototype: Object with torrent properties i.e. 'piece length',
 *          onprogress: Function to be called with (status, statusArg, progress, progressMax) arguments,
 *          onload: Function to be called with (Torrent) after completion.
 *          onerror: Function to be called with (Error) if an exception occurs.
 *      }
 *
 *  @Return: promise - Promise Object
 */
 
 const { filePicker, createTorrent } = require('./creator');
 
    filePicker('Select File').then(fileURL => {
        createTorrent({
            source: fileURL,
            prototype: {
                'comment': 'This is an example torrent comment.'
            },
            onprogress: function (status, statusArg, progress, progressMax) {
                console.log(statusArg + ': ' + progress + ' of ' + progressMax);
            },
            onload: function (torrent) {
                torrent.finish();
                let file = torrent.saveToDisk();
                console.log('\n\nSaved torrent: "' + file.path + '"\n');
                console.log('Opening torrent: ' + torrent.getHash());
                file.launch();
            },
            onerror: function (error) {
                console.exception(error);
            }
        });
    }, error => console.exception(error));
```

License

-------



MPL 2.0
