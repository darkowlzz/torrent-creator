Torrent Creator
=============
Torrent creation module for FireBit that can be ran as a separate extension.

###Run torrent creator as an add-on
```code
git clone git@github.com:DecipherCode/torrent-creator.git torrent-creator
cd torrent-creator
cfx run // use cfx xpi to create torrent-creator.xpi package.
```

Module Installation
-----------

There must be a _packages_ directory located at the root of your add-on's package. This package should be stored in the package's directory.

### Directory Structure

```code
Relative: /packages/torrent-creator

- some-addon.xpi

    /packages
        /torrent-creator
            /lib
                /...
        /another-package
            /...
    /lib
        /main.js
    /data
        /...
    
```


### Modify "package.json"
You will need to list _torrent-creator_ as a dependency. Below is an example add-on's package.json. 

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
    "dependencies": ["api-utils", "addon-kit", "torrent-creator"],
    "packages": "packages",
    "version": "1.0",
    "lib": "lib",
    "fullName": "Some Addon",
    "main": "main",
    "id": "someaddon@site.com",
    "name": "some-addon"
}
```

###Require Library
```javascript
    const { promptUser } = require('torrent-creator/creator');
    function progress(aStatus, aProgress, aProgressMax) {
        console.log(aProgress + ' of ' + aProgressMax, 'Status: ' + aStatus);
    }
    function callback(torrent, error) {
        if (error) {
            console.log(error.message);
            console.log('Torrent creation failed.');
        } else {
            console.log('Torrent created successfully!');
            let file = torrent.saveToFile();
            console.log('\n\nSaved torrent: "' + file.path + '"\n', torrent);
            console.log('Opening torrent: ' + torrent.getHash());
            file.launch();
        }
    }

    promptUser('Select File', callback, progress, false, true);
```


License
------

MPL 2.0
