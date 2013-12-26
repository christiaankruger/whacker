/* Author: GC Kruger
*/

$(document).ready(function() {   

  var socket = io.connect();

  $('#submit-btn').bind('click', function() {
  	var name = $("#player-name").val();
  	socket.emit('login', name);
  })

  $('#sender').bind('click', function() {
   socket.emit('message', 'Message Sent on ' + new Date());     
  });

  socket.on('server_message', function(data){
   $('#receiver').append('<li>' + data + '</li>');  
  });

  socket.on('login-success', function()
  {
  	console.log("received handshake");
  	$('#submit-btn').html("Waiting for other players");
  	$('#player-name').prop("disabled", true);
  });

  socket.on('starting', function(data)
  {
  	$('#submit-btn').html("Ready to start, " + data);

  	$('#content').html("Woop!");

  });
});