//Global variables
var players = 0;
var player_names = [];
var grid = [];
var queue = [];
var nextQueue = [];
var weaponsBank = [];


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

  socket.on('convert', function(name)
  {
      convertRandomBlock(name);
      removeWeapon("convert", name);
  });

  socket.on('disconnect', function(){
    console.log('Client Disconnected.');
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
    
}

function messageAll(message) {
  io.sockets.clients().forEach(function (socket) {
      socket.emit('message', message);  
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
      grid.push({owner: "Blank", remark: "None"});
    }

    shuffle(grid);

}

function assignWeapons()
{

  console.log("Assigning weapons");
  player_names.forEach(function(player)
  {
      console.log("Player = " + player);
      var weapons = [];
      // Level 1
      weapons.push(weapons1[0]);
      weapons.push(weapons1[1]);

      //Level 2
      for(var i = 0; i < 2; i++)
      {
        weapons.push(weapons2[Math.floor(Math.random() * weapons2.length)]);
      }

      //Level 3
      for(var i = 0; i < 2; i++)
      {
        weapons.push(weapons3[Math.floor(Math.random() * weapons3.length)]);
      }

      console.log("Weapons = " + weapons);

      weaponsBank.push({
        owner: player,
        weapons: weapons
      });
  });
}

function removeWeapon(weapon, name)
{
    for(var i = 0; i < weaponsBank.length; i++)
    {
        var w = weaponsBank[i];
        if(w.owner == name) {
           var weapons = w.weapons;
           var index = weapons.lastIndexOf(weapon);
           weapons.splice(index, 1);
           w.weapons = weapons;
        }

    }
    
    console.log("Removed " + weapon + " from " + name);
}

///////////////////////////////////////////
//       queue system                    //
///////////////////////////////////////////

/*
    List of instructions:

    kill [x] [killer] [msg] -> kill block x
    killrandom [killer] [msg] -> kill random alive block
    killadj [x] [killer] [msg] -> kills blocks adjacent to x (not x)
    defer [x] [command] -> defer command for x turns
    
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


function executeKill (x, killer, msg)
{
    //kill [x] [msg]
    //ex 'kill 4 "A killed B"'

}