addon.port.emit("ready");
addon.port.on("init", sayStuff);

function sayStuff(message) {
  console.log("got the message '" + message + "'" );
}