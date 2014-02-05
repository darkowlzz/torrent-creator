/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

let container = document.getElementById("download-container");

function Item(id, fileName) {

  let downloadItem = document.createElement("div");
  downloadItem.className = "downloadItem";

  // Torrent file name.
  let title = document.createElement("div");
  title.className = "title";
  title.textContent = fileName;
  downloadItem.appendChild(title);

  let progressdiv = document.createElement("div");
  progressdiv.className = "progressdiv";

  // Progress meter.
  let progressbar = document.createElement("div");
  progressbar.className = "progressbar";
  progressdiv.appendChild(progressbar);

  downloadItem.appendChild(progressdiv);

  // Download progress.
  let progress = document.createElement("span");
  progress.className = "progress";
  progress.value = 0;
  progress.textContent = 0;

  // Download size.
  let progressMax = document.createElement("span");
  progressMax.className = "progress";
  progressMax.value = undefined;
  progressMax.textContent = String(progressMax.value);

  // Download status.
  let status = document.createElement("div");
  let textDownloaded = document.createTextNode("Downloaded ");
  let textOf = document.createTextNode(" of ");
  status.appendChild(textDownloaded);
  status.appendChild(progress);
  status.appendChild(textOf);
  status.appendChild(progressMax);
  downloadItem.appendChild(status);

  // Append to the main download panel.
  container.appendChild(downloadItem);

  return {
    updateProgress: function (val) {
      if (val <= progressMax.value) {
        progress.value = val;
        progress.textContent = String(progress.value);
        let s = (progress.value/progressMax.value) * progressdiv.offsetWidth;
        progressbar.style.width = s + "px";
      }
    },
    updateProgressMax: function (val) {
      progressMax.value = val;
      progressMax.textContent = String(progressMax.value);
    }
  };
}

// List of all the download items.
let items = {};

// Create a download item and add to the download list.
function create(id, fileName) {
  let temp = new Item(id, fileName);
  items[id] = temp;

  return temp;
}

// Listen to download item create signal and create it.
self.port.on("create", function(id, fileName) {
  create(id, fileName);
});

// Listen to item progress signal and update item progress.
self.port.on("progress", function(id, progress) {
  items[id].updateProgress(progress);
});

// Listen to item progressMax update signal and update item progressMax.
self.port.on("progressMax", function(id, progressMax) {
  items[id].updateProgressMax(progressMax);
});
