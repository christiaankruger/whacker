//Global variables
var players = 0;
var player_names = [];
var grid = [];
var queue = [];
var nextQueue = [];
var weaponsBank = [];
var dead = [];
var turn = "";
var turnIndex = -1;


var weapons1 = ["shield", "convert"];
var weapons2 = ["deflect", "steal", "rotten"];
var weapons3 = ["nuke", "emp", "kamikaze"];

//setup Dependencies
var connect = require('connect')
    , express = require('express')
    , io = require('socket.io')
    , port = (process.env.PORT || 8081)
    , sys = require('sys');

//Setup Express
var server = express.createServer();
server.configure(function(){
    server.set('views', __dirname + '/views');
    server.set('view options', { layout: false });
    server.use(connect.bodyParser());
    server.use(express.cookieParser());
    server.use(express.session({ secret: "shhhhhhhhh!"}));
    server.use(connect.static(__dirname + '/static'));
    server.use(server.router);
});

//Setup standard in
var stdin = process.openStdin();
stdin.addListener("data", function(d)
{
  var data = d.toString().substring(0, d.length-1);
  if (data == "start") {
    //Starting game
    console.log("Starting server.");
    StartServer();
  }
  if(data == "grid") {
    //Show grid
    for(var i = 0; i < grid.length; i++)
    {
      console.log((i+1) + ": " + grid[i].owner + ", " + grid[i].remark);
    }
  }
  if(data == "weapons") {
    for(var i = 0; i < weaponsBank.length; i++)
    {
      var w = weaponsBank[i];
      console.log("Player: " + w.owner);
      console.log("Weapons: " + w.weapons);
    }
  }
  if(data == "players") {
    console.log(players);
  }

  if(data == "queue") {
    console.log(queue.join(", "));
  }
});


//setup the errors
server.error(function(err, req, res, next){
    if (err instanceof NotFound) {
        res.render('404.jade', { locals: { 
                  title : '404 - Not Found'
                 ,description: ''
                 ,author: ''
                 ,analyticssiteid: 'XXXXXXX' 
                },status: 404 });
    } else {
        res.render('500.jade', { locals: { 
                  title : 'The Server Encountered an Error'
                 ,description: ''
                 ,author: ''
                 ,analyticssiteid: 'XXXXXXX'
                 ,error: err 
                },status: 500 });
    }
});
server.listen( port);

//Setup Socket.IO
var io = io.listen(server);
io.sockets.on('connection', function(socket){
  console.log('Client Connected');
  socket.on('message', function(data){
    socket.broadcast.emit('server_message',data);
    socket.emit('server_message',data);
  });
  socket.on('login', function(data) {
    console.log(data + " has connected.");
    if(player_names.lastIndexOf(data) >= 0) {
      socket.emit('invalid-name');
      return;
    }
    socket.emit('login-success');
    socket.set('name', data);
    player_names.push(data);
    console.log("player names now: " + player_names);
    players++;
  });

  socket.on('shield-me', function(name)
  {
      shieldPlayer(name);
      removeWeapon("shield", name);
  });

  socket.on('deflect-me', function(name)
  {
      deflectPlayer(name);
      removeWeapon("deflect", name);
  });

  socket.on('deflect-add', function(name)
  {
      addWeapon("deflect", name);
  });

  socket.on('convert', function(name)
  {
      removeWeapon("convert", name);
      convertRandomBlock(name);
  });

  socket.on('emp', function(name) {

    putOnQueue("emp " + name);
    removeWeapon("emp", name);
    processQueue();

  });

  socket.on('disconnect', function(){
    console.log('Client Disconnected.');
  });

  socket.on('kill', function(num, killer)
  {
      if(turn != killer) {
        messageOne(killer, "It's not your turn");
        return;
      }

      var cmd = "kill " + num + " " + killer + " headshot";
      putOnQueue(cmd);
      processQueue();

  });

  socket.on('nuke', function(num, killer)
  {
      if(turn != killer) {
        messageOne(killer, "It's not your turn");
        return;
      }

      console.log("nuke request received");

      //Count alive in row
      var alive_row = 1;
      var alive_col = 1;
      var index = num;
      
      //Move to the start of the row
      while(index % 6 != 1) {
        index--;
      }

      for(var i = index; i < index + 6; i++) {
        if(grid[i-1].remark != "dead") {
          alive_row++;
        }
      }

      //Count alive in col
      index = num % 6 == 0? 6 : num % 6;
      for(var i = index; i < 37; i+=6) {
        if(grid[i-1].remark != "dead") {
          alive_col++;
        }
      }

      //Let's do the most damage
      if(alive_row <= alive_col) {
        //Kill col
        putOnQueue("killcol " + num + " " + killer + " nuke");
      } else {
        //Kill row
        putOnQueue("killrow " + num + " " + killer + " nuke");
      }

      removeWeapon("nuke", killer);
      processQueue();

  });

  socket.on('rot', function(num, killer)
  {
      if(turn != killer) {
        messageOne(killer, "It's not your turn");
        return;
      }

      console.log("rotten request received");
      var killcmd = "kill " + num + " " + killer + " rotten";

      // kill x
      // colorblack x
      // defer 1 colorred x
      // defer 1 killadj x 1

      putOnQueue("defer 1 killadj " + num + " 1 " + killer + " rotten");
      putOnQueue("defer 1 colorred " + num);
      putOnQueue("colorblack " + num);
      putOnQueue(killcmd);

      removeWeapon("rotten", killer);

      console.log("Queue = " + queue.join(","));
      processQueue();


  });

  socket.on('steal', function(num, killer)
  {
       if(turn != killer) {
        messageOne(killer, "It's not your turn");
        return;
      }

      console.log("Time to steal");

      var owner = grid[num-1].owner;
      if(owner == killer) {
        messageAll("[steal] " + killer + " tried to steal from themself.");
      } else {

        for(var i = 0; i < weaponsBank.length; i++) {

          var w = weaponsBank[i];
          if(w.owner == owner)
          {
              if(w.weapons.length == 0) {
                messageAll("[steal] " + killer + " tried to steal from " + owner + ", but " + owner + " has no weapons.");
              } else {

                shuffle(w.weapons);
                var weaponarr = w.weapons.splice(0, 1);
                var weapon = weaponarr[0];
                addWeapon(weapon, killer);
                var msg = "[steal] " + killer + " stole a " + weapon + " from " + owner;
                messageAll(msg);
              }

          }
        }
      }

      removeWeapon("steal", killer);
      processQueue();

  });

  socket.on('kamikaze', function(player)
  {

      if(turn != player) {
        messageOne(player, "It's not your turn");
        return;
      }

      var blocks = [];
      for(var i = 0; i < grid.length; i++)
      {
          if(grid[i].owner == player && grid[i].remark != "dead") {
            blocks.push(i);
          }
      }
      var index = blocks[Math.floor(Math.random() * blocks.length)];

      putOnQueue("killadj " + (index + 1) + " 8 " + player + " kamikaze");
      putOnQueue("kill " + (index + 1) + " " + player + " kamikaze");

      removeWeapon("kamikaze", player);

      processQueue();

  });

});




///////////////////////////////////////////
//              Routes                   //
///////////////////////////////////////////

/////// ADD ALL YOUR ROUTES HERE  /////////

server.get('/', function(req,res){
  res.render('login.jade', {
    locals : { 
              title : 'Login | Whacker'
             ,description: 'Your Page Description'
             ,author: 'Your Name'
             ,analyticssiteid: 'XXXXXXX' 
            }
  });
});

server.get('/status/:number', function(req, res)
{
    var num = req.params.number;
    if (num < 1 || num > 36) {
      res.write("invalid");
    } else {
      var owner = grid[num - 1].owner;
      res.write(owner);
    }
    res.end();
});

server.get('/scores', function(req, res)
{
    var scores = gatherScores();
    res.write(JSON.stringify(scores));
    res.end();
});

server.get('/weapons/:name', function(req, res)
{
    console.log("Received weapons request");
    var name = req.params.name;
    for(var i = 0; i < weaponsBank.length; i++)
    {
        var w = weaponsBank[i];
        if(w.owner == name) {
          res.write(JSON.stringify(w.weapons));
        }
    }
    res.end();
});

server.get('/turn', function(req, res)
{
  console.log("Received turn request");
  res.write(turn);
  res.end();
});

//A Route for Creating a 500 Error (Useful to keep around)
server.get('/500', function(req, res){
    throw new Error('This is a 500 Error');
});

//The 404 Route (ALWAYS Keep this as the last route)
server.get('/*', function(req, res){
    throw new NotFound;
});

function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}


console.log('Listening on http://0.0.0.0:' + port );

///////////////////////////////////////////
//              Helpers                  //
///////////////////////////////////////////

function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

///////////////////////////////////////////
//              Whacker                  //
///////////////////////////////////////////

function StartServer()
{

   assignWeapons();
   populateGrid();
   
   io.sockets.clients().forEach(function (socket) {
      socket.emit('starting', player_names.join(", "));  
    });

   nextTurn();
}

function nextTurn()
{
    turnIndex++;
    messageOne(turn, "Your turn is over.");
    if(turnIndex >= player_names.length) turnIndex = 0;

    turn = player_names[turnIndex];
    messageOne(turn, "It's now your turn.");
}


function shieldPlayer(name)
{
  var blocks = [];
  for(var i = 0; i < grid.length; i++)
  {
      if(grid[i].owner == name && grid[i].remark != "dead") {
        blocks.push(i);
      }
  }

  var index = blocks[Math.floor(Math.random() * blocks.length)];
  grid[index].remark = "shield";
  console.log("Shielded " + name + " at block " + (index + 1));
}

function deflectPlayer(name)
{
  var blocks = [];
  for(var i = 0; i < grid.length; i++)
  {
      if(grid[i].owner == name && grid[i].remark == "none") {
        blocks.push(i);
      }
  }

  var index = blocks[Math.floor(Math.random() * blocks.length)];
  grid[index].remark = "deflect";
  console.log("Deflectorized " + name + " at block " + (index + 1));
}

function convertRandomBlock(name)
{
    var blocks = [];
    var originalOwner = "";
    for(var i = 0; i < grid.length; i++)
    {
        if(grid[i].remark == "none" && grid[i].owner != name) {
          blocks.push(i);
        }
    }

    console.log("Converting! Blocks = ");
    for(var i = 0; i < blocks.length; i++)
    {
      console.log((i+1) + ": Curr owner = " + grid[i].owner);
    }


    var index = blocks[Math.floor(Math.random() * blocks.length)];
    originalOwner = grid[index].owner;
    grid[index].owner = name;
    console.log("Block " + (index + 1) + " now belongs to " + name);
    //Notify player of his new block!
    io.sockets.clients().forEach(function (socket) {
      socket.get('name', function(err, pname) {
        console.log("pname = " + pname);
        if(pname == name) {
          socket.emit('converted-gain', (index+1));
        } else if (pname == originalOwner) {
          socket.emit('converted-loss', (index+1));
        }
      });
      
    });
    var msg = name + ' stole a block from ' + originalOwner;
    messageAll(msg);

    processQueue();
    
}

function messageAll(message) {
  console.log("Sending " + message + " to all.");
  io.sockets.clients().forEach(function (socket) {
      socket.emit('message', message);  
    });
}

function messageOne(player, message) {
  console.log("Sending " + message + " to " + player);
  io.sockets.clients().forEach(function (socket) {
      socket.get('name', function(err, pname) {
        if(pname == player) {
          socket.emit('message', message);  
        }
      });
    });
}

function populateGrid()
{
    var perPlayer = Math.round(36/players);
    var index = 0;
    for(var i = 0; i < players; i++) {
      for(var j = 0; j < perPlayer; j++) {

        grid.push({owner: player_names[i], remark: "none"});
      }
    }

    var blanks = 36 - grid.length;
    for(var i = 0; i < blanks; i++)
    {
      grid.push({owner: "Blank", remark: "blank"});
    }

    shuffle(grid);

}

function assignWeapons()
{

  console.log("Assigning weapons");
  var weapons = [];
  for (var i = 0; i < player_names.length; i++) {

    //
    weapons.push("rotten");
    weapons.push("steal");
    weapons.push("deflect");
    weapons.push("rotten"); //Soon to be replaced by 4th weapon
  }

  weapons.push("nuke");
  weapons.push("emp");
  weapons.push("kamikaze");

  shuffle(weapons);

  for(var i = 0; i < player_names.length; i++) {

    var player = player_names[i];
    var my_weapons = [];
    my_weapons.push("shield");
    my_weapons.push("convert");
    var my_good_weapons = weapons.splice(0, 4);
    for(var k = 0; k < my_good_weapons.length; k++) {
      var w = my_good_weapons[k];
      my_weapons.push(w);
    }

    weaponsBank.push(
    {
        owner: player,
        weapons: my_weapons
    });

  }


}

function removeWeapon(weapon, name)
{
    for(var i = 0; i < weaponsBank.length; i++)
    {
        var w = weaponsBank[i];
        if(w.owner == name) {
           var weapons = w.weapons;
           var index = w.weapons.lastIndexOf(weapon);
           w.weapons.splice(index, 1);
        }

    }
    console.log("Removed " + weapon + " from " + name);
}

function addWeapon(weapon, name)
{
    for(var i = 0; i < weaponsBank.length; i++)
    {
        var w = weaponsBank[i];
        if(w.owner == name) {
           w.weapons.push(weapon);
        }

    }
    console.log("Added " + weapon + " to " + name);
}

function hasWeapon (weapon, name)
{
    for(var i = 0; i < weaponsBank.length; i++)
    {
        var w = weaponsBank[i];
        if(w.owner == name) {
           var weapons = w.weapons;
           var index = weapons.lastIndexOf(weapon);
           if (index >= 0) return true;
           return false;
        }

    }
}


function checkForDead() {

  var someoneDead = false;
  for(var i = 0; i < player_names.length; i++) {
    var count = 0;
    var player = player_names[i];
    for(var j = 0; j < grid.length; j++) {

      if(grid[j].owner == player) {
        if(grid[j].remark != "dead") {
          count++;
        }
      }
    }
    if(count == 0) {
      //He dead
      messageAll("[system] " + player + " has been whacked!");
      dead.push(player);
      player_names.splice(i, 1);
      i--;
      someoneDead = true;
    }
  }

  if(someoneDead) {
    messageAll("[system] Turn order randomized.");
    shuffle(player_names);
    turnIndex = -1;
  }
}

function checkForWin () {
  if(player_names.length == 1) {
    return true;
  }
  return false;
}

function gatherScores()
{
    var scores = [];
    for(var i = 0; i < player_names.length; i++) {
      var alive = 0;
      var player = player_names[i];
      for(var j = 0; j < grid.length; j++) {
        if (grid[j].owner == player) {
          if(grid[j].remark != "dead") {
            alive++;
          }
        }
      }
      scores.push({
        player: player,
        score: alive
      });
    }

    //Easy sort
    for(var i = 0; i < scores.length; i++) {
      for(var j = i; j < scores.length; j++) {

        if(scores[i].score < scores[j].score) {
          var temp = scores[i];
          scores[i] = scores[j];
          scores[j] = temp;
        }

      }
    }

    for(var i = 0; i < dead.length; i++) {
      scores.push({
        player: dead[i],
        score: 0
      });
    }

    console.log("Scores");
    console.log(scores);
    return scores;
}

///////////////////////////////////////////
//       queue system                    //
///////////////////////////////////////////

/*
    List of instructions:

    kill [x] [killer] [msg] -> kill block x
    killrandom [killer] [msg] -> kill random alive block
    killadj [x] [n] [killer] [msg] -> kills up to n blocks adjacent to x (not x)
    defer [x] [command] -> defer command for x turns
    colorred [x]
    colorblack [x]
    killrow [x] [killer]
    killcol [x] [killer]
    
    note: killrow/col gets converted to kill
    note: killer is the name of the killer
    note: killadj gets converted to 8 kills
    note: killrandom gets converted to kill
    note: defer [x] [cmd] gets converted to defer [x-1] [cmd] 
    note: msg will be broadcasted to all players
*/

/* Queue system ;
   1. originates at processQueue
   2. calls execute[command]
   3. execute[command] calls processQueue
   4. once queue is empty, next player's turn
*/

function processQueue()
{
    if(queue.length == 0) {
      
      //Bring in next queue and execute.
      queue = nextQueue;
      nextQueue = [];
      nextTurn();
      return;
    }

    console.log("Processing Queue");
    var cmd = queue.splice(0, 1).toString();

    console.log("Command = " + cmd);
    var parts = cmd.split(" ");
    switch(parts[0]) {

      case "kill":
        executeKill(parts[1], parts[2], parts[3]);
        break;

      case "killrandom":
        executeKillRandom(parts[1], parts[2]);
        break;

      case "killadj":
        executeKillAdj(parts[1], parts[2], parts[3], parts[4]);
        break;

      case "defer":
        parts.splice(0, 1);
        var n = parts.splice(0, 1);
        executeDefer(n, parts.join(" "));
        break;

      case "colorred":
        executeColorRed(parts[1]);
        break;

      case "colorblack":
        executeColorBlack(parts[1]);
        break;

      case "killcol":
        executeKillCol(parts[1], parts[2], parts[3]);
        break;

      case "killrow":
        executeKillRow(parts[1], parts[2], parts[3]);
        break;

      case "emp":
        executeEMP(parts[1]);
        break;
    }

    checkForDead();
    if(checkForWin()) {
      queue = [];
      messageAll("[system] " + player_names[0] + " is the winner.");
      return;
    }
    processQueue();
}

//x is one based!
function executeKill (x, killer, msg)
{
    //kill [x] [msg]
    //ex 'kill 4 "A killed B"'

    var owner = grid[x-1].owner;

    //1. Update remark
    if(grid[x-1].remark == "shield") {
      var toSend = owner + " has been saved by their shield";
      messageAll(toSend);
      messageOne(owner, "Your shield is broken.");
      grid[x-1].remark = "none";

    } else if (grid[x-1].remark == "deflect") {
      var toSend = owner + " deflected the attack";
      messageAll(toSend);
      messageOne(owner, "Your block is no longer deflectorized.");
      grid[x-1].remark = "none";
      var newCommand = "killrandom " + owner + " deflect";
      putOnQueue(newCommand);
    }

    else {

      if(grid[x-1].remark == "blank") {
        msg = "blank";
      }
      grid[x-1].remark = "dead";

      //2. Send message to all
      if(!msg) {
        msg = killer + " shot " + owner;
      } else {
        var newMsg = "[" + msg + "] " +  killer + " shot " + owner;
        msg = newMsg;
      }
      messageAll(msg);

      //3. Send notifications
      io.sockets.clients().forEach(function (socket) {
        socket.emit('killed', x);  
      });
    }
    
}

//Kills random non-dead block
//Convert killrandom to kill
function executeKillRandom(killer, msg)
{

    var blocks = [];
    for(var i = 0; i < grid.length; i++)
    {
        if(grid[i].remark != "dead") {
          blocks.push(i);
        }
    }

    var index = blocks[Math.floor(Math.random() * blocks.length)];
    var command = "kill " + (index + 1) + " " + killer + " " + msg;
    putOnQueue(command);

    //processQueue();

}

function executeKillAdj(x, n, killer, msg)
{
    console.log("Processing killadj");
    var adj = getAdj(x);
    shuffle(adj);
    console.log("adj = " + adj.join(", "));
    for (var i = 0; i < n; i++) {
      if(adj.length == 0) break;
      var index = adj.pop();
      if(grid[index-1].remark == "dead") continue;
      putOnQueue("kill " + index + " " + killer + " " + msg);
    }

    //processQueue();
}

function executeKillRow(x, killer, msg)
{
    console.log("Processing killrow");
    
    var index = x;

    while(index % 6 != 1) {
        index--;
      }

      for(var i = index; i < index + 6; i++) {
        if(grid[i-1].remark != "dead") {
          putOnQueue("kill " + i + " " + killer + " " + msg);
        }
      }

    //processQueue();
}

function executeKillCol(x, killer, msg)
{
    console.log("Processing killcol");  
    var index = x;

    index = x % 6 == 0? 6 : x % 6;
    for(var i = index; i < 37; i+=6) {
      if(!grid[i-1]) continue;
      if(grid[i-1].remark != "dead") {
        putOnQueue("kill " + i + " " + killer + " " + msg);
      }
    }
  //  processQueue();
}

function executeColorRed(x)
{
    io.sockets.clients().forEach(function (socket) {
        socket.emit('color-red', x);  
      });

   // processQueue();
}

function executeColorBlack(x)
{
    io.sockets.clients().forEach(function (socket) {
        socket.emit('color-black', x);  
      });

   // processQueue();
}

function executeEMP(killer, msg)
{
    console.log("Eeeehhhhhhh");
    for(var i = 0; i < player_names.length; i++) {
        for(var j = 0; j < weapons2.length; j++) {
          var player = player_names[i];
          var weapon = weapons2[j];
          if(player == killer) continue;

          while(hasWeapon(weapon, player)) {
            removeWeapon(weapon, player);
          }

        }

      }
    messageAll("[EMP] " + killer + " used EMP. All level 2 weapons broken.");
    //processQueue();
}

function executeDefer(n, command)
{

  console.log("Deferring " + command + " with " + n + " rounds");
  if(n == 1) {
    addToNextQueue(command);
    console.log(command + " added to nextQueue");
  }
  else {
    n--;
    var cmd = "defer " + n + " " + command;
    addToNextQueue(cmd);
  }
  //processQueue();
}

function putOnQueue(command) 
{
  queue.reverse();
  queue.push(command.toString());
  queue.reverse();
}

function addToQueue(command)
{
    queue.push(command);
}

function addToNextQueue(command)
{
  nextQueue.push(command.toString());
}

function getAdj(xn)
{
    var n = parseInt(xn);
    var coords = [];
    //For n == 1
    if(n == 1) {
      coords.push(2);
      coords.push(7);
      coords.push(8);
      return coords;
    }

    if(n == 6) {
      coords.push(5);
      coords.push(11);
      coords.push(12);
      return coords;
    }

    if(n == 31) {
      coords.push(25);
      coords.push(26);
      coords.push(32);
      return coords;
    }

    if(n == 36) {
      coords.push(29);
      coords.push(30);
      coords.push(35);
      return coords;

    }


    //Top row
    if(n <= 6)
    {
        coords.push(n-1);
        coords.push(n+1);
        coords.push(n+5);
        coords.push(n+6);
        coords.push(n+7);
        return coords;
    }

    //Left
    if(n % 6 == 1) {
        coords.push(n-6);
        coords.push(n-5);
        coords.push(n+1);
        coords.push(n+6);
        coords.push(n+7);
        return coords;
    }

    //Right
    if (n % 6 == 0) {
        coords.push(n-6);
        coords.push(n+5);
        coords.push(n-1);
        coords.push(n+6);
        coords.push(n-7);
        return coords;      
    }

    //Bottom
    if(n >= 31 && n <= 36) {

        coords.push(n+1);
        coords.push(n-5);
        coords.push(n-1);
        coords.push(n-6);
        coords.push(n-7);
        return coords;   

    }

    //General

    coords.push(n-7);
    coords.push(n-6);
    coords.push(n-5);
    coords.push(n-1);
    coords.push(n+1);
    coords.push(n+5);
    coords.push(n+6);
    coords.push(n+7);
    return coords;

}