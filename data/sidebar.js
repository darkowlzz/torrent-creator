window.addEventListener('load', event => {
    // Select source on click.
    const source = document.querySelector('#input-source');
    source.addEventListener('focus', event => source.select());
    // Drag and drop source
    window.addEventListener('dragenter', event => event.preventDefault());
    window.addEventListener('dragover', event => event.preventDefault());
    window.addEventListener('drop', event =>
            addon.port.emit('get-type',
            source.value = event.dataTransfer.getData('text/x-moz-url')));

    // Single or multiple file torrent mode selection
    const multiMode = document.querySelector('#multi-mode');
    const singleMode = document.querySelector('#single-mode');
    singleMode.checked = true;
    multiMode.addEventListener('click', event => singleMode.checked = false);
    singleMode.addEventListener('click', event => multiMode.checked = false);
    const getMode = () => multiMode.checked;

    addon.port.on('source', fileURL => source.value = fileURL);
    addon.port.on('set-type', isDirectory => {
        singleMode.checked = !isDirectory;
        multiMode.checked = isDirectory;
    });

    document.querySelector('#select-source').addEventListener('click', event =>
            addon.port.emit('select-source', getMode()));
});