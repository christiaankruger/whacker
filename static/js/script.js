/* Author: GC Kruger
*/

//Global variables

var name = "";
var controller;
var queries = 3;

var myTurn = true;


var inQuery = false;

var socket;

var msg_query = "Select a block to query.";
var msg_end = "Type 'cancel' to cancel action.";

$(document).ready(function() {   

  socket = io.connect();

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

  socket.on('invalid-name', function() {
    alert("Name already in use, please pick another one");
    $("#player-name").val("");
  });

  socket.on('login-success', function()
  {
  	console.log("received handshake");
  	$('#submit-btn').html("Waiting for other players");
  	$('#player-name').prop("disabled", true);
  });

  socket.on('converted-gain', function(index)
  {
    console.log("Got converted signal.");
    $("#button" + index).removeClass("btn-success");
    $("#button" + index).addClass("btn-primary");
    setButtonText(index, name);
  });

  socket.on('converted-loss', function(index)
  {
    $("#button" + index).removeClass("btn-success");
    $("#button" + index).removeClass("btn-primary");
    $("#button" + index).addClass("btn-success");
    setButtonText(index, index);
    showMessage("You lost a block, too bad.");
  });

  socket.on('message', function(msg)
  {
    showMessage(msg);
  });

  socket.on('starting', function(players)
  {
    setupGrid(players);

  });
});


function setupGrid(players)
{
    var html = new EJS({url: '/templates/grid.ejs'}).render();
    $('.main-container').html(html);  
    buildConsole(players);
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
     var buttonID = "button" + (i + 1);
     var buttonHTML = new EJS({url: '/templates/button.ejs'}).render({label: label, num: (i+1)});
     $('#battlezone').append(buttonHTML);
     
   }
  
}

function buildConsole(players)
{
  
  var welcome = "Welcome to Whacker, " + name + ".\n Your opponents are: " + players + ".";

   var console = $('<div class="console1">');
   $('#console-container').append(console);
   controller = console.console({
      promptLabel: 'Whacker > ',
      welcomeMessage: welcome,
      commandHandle: function(line) {
         if (line) {
              //return [{msg:"you typed " + line,className:"jquery-console-message-value"}];
              var msg = "Affirmative.\n Second line?";
              var className = "jquery-console-message-value";
              var parts = line.split(" ");
              if(line == "clear") {
                controller.reset();
                return;
              } else if(line == "queries") {
                msg = "You have " + queries + " queries left.";
              } 

              else if(line == "cancel")
              {
                //set all in variables to false
                inQuery = false;
                msg = "Action cancelled.";
              }

              else if(parts[0] == "use") 
              { 
                var result = processCommand(parts);
                msg = result;
              }
              else if(line == "weapons") {
                var weapons = showWeapons();
                msg = weapons;
              }
              else {
                msg = "Invalid command.";
              }


              
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

function showWeapons() {

  var weapons = "Your weapons are:\n";
  $.ajax(
    {
        url: '/weapons/' + name,
        async: false,
        success: function(data)
        {
            console.log("data = " + data);
            var arr = JSON.parse(data);
            for(var i = 0; i < arr.length; i++)
            {
              weapons += (i + 1) + ". " + arr[i] + "\n";
            }
            if(arr.length == 0) {
              weapons = "You have no weapons left.";
            }
        }
    });

  return weapons;

}

function processCommand(cmd)
{
    switch(cmd[1])
    {
      case "query":
        if(queries == 0) return "You don't have any queries left.";
        var victim = cmd[2];
        console.log("victim = " + victim);
        if(!isInt(victim)) {
          return "Please enter the number of your target.";
        }
        if(victim > 36 || victim < 1) {
          return "Please enter a number between 1 and 36";
        }

        var owner = processQuery(victim);
        setButtonText(victim, owner);
        return "This block belongs to " + owner;

          break;
      case "shield":
        var valid = checkWeapon("shield");
        if (!valid) {
          return "You don't have this weapon.";
        }
        //Notify server of shield
        socket.emit('shield-me', name);
        return "One of your blocks has been shielded.";

        break;

      case "deflect":
        var valid = checkWeapon("deflect");
        if (!valid) {
          return "You don't have this weapon.";
        }
        //Notify server of shield
        socket.emit('deflect-me', name);
        return "One of your blocks has been deflectorized.";

        break;

      case "convert":
        var valid = checkWeapon("convert");
        if (!valid) {
          return "You don't have this weapon.";
        }
        //Notify server of shield
        socket.emit('convert', name);
        return "You have a new block.";

        break;
    }
}

function setButtonText(num, data)
{
    $("#button" + num +" .coord").html(data);
}

function processClick(num)
{

}

function processQuery(num)
{
    var owner = "";
    $.ajax(
    {
      url: '/status/' + num,
      async: false,
      success: function(data)
      {
        owner = data;
      }
    });

    queries--;
    return owner;
}

function isInt(data)
{
  return data == parseInt(data);
}

function checkWeapon(weapon)
{

    var valid = false;
    $.ajax(
    {
        url: '/weapons/' + name,
        async: false,
        success: function(data)
        {
            console.log("data = " + data);
            var arr = JSON.parse(data);
            if(arr.lastIndexOf(weapon) >= 0) {
              //We have it!
              valid = true;
            } else {
              //Nice try
              valid = false;
            }
        }
    });
    return valid;
}