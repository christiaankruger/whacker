/* Author: GC Kruger
*/

//Global variables

var name = "";
var controller;

$(document).ready(function() {   

  var socket = io.connect();

  $('#submit-btn').bind('click', function() {
  	name = $("#player-name").val();
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

  socket.on('starting', function(players)
  {
    setupGrid();

  });
});


function setupGrid()
{
    var html = new EJS({url: '/templates/grid.ejs'}).render();
    $('.main-container').html(html);  
    fillBlocks();
    buildConsole();
    $("#message-box").attr("disabled", "disabled");
    fillBlocks(36);
}


function fillBlocks(n)
{
   var k = Math.round(Math.random()*n)
   for(var i = 0; i < n ;i++)
   {
     var label = "";
     if(i == k) label = "Mine";
     $('#battlezone').append('<div class="btn btn-success grid odd"><div class="coord">' + label + ' </div></div>');
   }
  
}

function buildConsole()
{
   var console = $('<div class="console1">');
   $('#console-container').append(console);
   controller = console.console({
      promptLabel: 'Whacker > ',
      welcomeMessage: 'Welcome to Whacker, ' + name + '.',
      commandHandle: function(line) {
         if (line) {
              //return [{msg:"you typed " + line,className:"jquery-console-message-value"}];
              if(line == "clear") {
                controller.reset();
                return;
              }


              var msg = "Affirmative.\n Second line?";
              var className = "jquery-console-message-value";
              return [{msg: msg, className: className}];
          }
      },
      cols: 40
   });
}


function showMessage(msg)
{
   $("#message-box").append(msg + "\n");
}