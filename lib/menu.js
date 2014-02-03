/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict';

module.metadata = {
  'stability': 'stable'
};

const { Cc, Ci } = require('chrome');

// Instantiate Services
const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWindowMediator
const windowWatcher = Cc['@mozilla.org/embedcomp/window-watcher;1'].getService(Ci.nsIWindowWatcher); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWindowWatcher

// Import SDK modules
const { when } = require('sdk/system/unload');
const { defer } = require('sdk/core/promise');

// Import other modules
const { enumToArray } = require('./utils');

// Constants
const BROWSER = 'navigator:browser';

// Define Helpers
const getWindows = (type) => enumToArray(windowMediator.getEnumerator(type || ''));

// Store elements for removal upon unload.
const items = [];

// Resolves when the window has been loaded.
const onLoaded = window => {
    let deferred = defer();
    if (window.document.readyState === 'complete')
        deferred.resolve(window);
    else {
        let onWindowLoad = (event) => {
            window.removeEventListener('load', onWindowLoad);
            deferred.resolve(window);
        };
        window.addEventListener('load', onWindowLoad);
    }
    return deferred.promise;
};

// Inserts a menu item before or after the element identified by selector.
const insertNear = (menu, label, selector, after) => {
    try {
        let index, item = menu.querySelector(selector);
        if (item !== null) {
            index = menu.getIndexOfItem(item);
            return menu.insertItemAt(after ? index+1 : index, label);
        }
    }
    catch (error) {}
};

// Define the command function and export a setter since I'm being lazy and
// don't want to define an API. ;)
let action = new Function();
const command = (event) => action(event);
const setMenuAction = value => {
    if (typeof value === 'function')
        action = value;
    else throw new TypeError('Menu action must be a function!');
};
exports.setMenuAction = setMenuAction;

// Configure and append the element to the menu.
const addMenuItem = window => {
    try {
        let label = 'Torrent Creator';
        // Get the tools-menu element.
        let item, menu = window.document.querySelector('#tools-menu');
        if (menu === null)
            return void(0);
        // Prevent repetive arguments.
        let insertAt = insertNear.bind(null, menu, label);
        // Attempt smart placement first.
        if ((item = insertAt('#devToolsSeparator', true)) !== void(0));
        else if ((item = insertAt('#webDeveloperMenu')) !== void(0));
        else if ((item = insertAt('#menu_pageInfo')) !== void(0));
        else if ((item = insertAt('#prefSep')) !== void(0));
        else item = menu.appendItem(label);
        items.push(item);
        item.setAttribute('id', 'torrent-creator');
        item.setAttribute('label', 'Torrent Creator');
        item.setAttribute('accessKey', 'T');
        item.setAttribute('acceltext', 'Ctrl+Shift+T')
        item.addEventListener('command', command);
    }
    catch (error) {
        console.exception(error);
    }
};

// Add the menu item to each window initially.
getWindows(BROWSER).forEach(window => onLoaded(window).then(window => addMenuItem(window)));

// Add the menu item to future windows.
const onOpen = {
    observe: (subject, topic, data) => {
        if (topic === 'domwindowopened')
            onLoaded(subject).then(window => addMenuItem(window));
    }
};

// Listen for windows being opened.
windowWatcher.registerNotification(onOpen);

// Unload properly.
when(reason => {
    windowWatcher.unregisterNotification(onOpen);
    while (items.length)
        items.shift().remove();
});


