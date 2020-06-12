/*
// エクスプレスサーバの設定

const express = require("express");
const app = express();
app.use(express.static("public"));

// ルーティング
app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

// 待ち受け実行
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

// シグナリングサーバの設定
("use strict");

var srv = require("http").Server();
var io = require("socket.io")(srv);
var port = 3002;
srv.listen(port);
console.log("signaling server started on port:" + port);
*/

// ハッシュライブラリ
const crypto = require("crypto");

// エクスプレスサーバ・ソケットサーバの基本設定
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var port = process.env.PORT || 3000;

// テンプレートエンジン
app.set("view engine", "ejs");

// POSTにも対応
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ルーティング
// トップ
app.get("/", (request, response) => {
  
  const testmode = 0; // 0:通常モード、 1:テストモード
  
  if(testmode){
    var data = {
        user_name: 'name',
        table_id: 'table_id',
        table_name: 'table_name'
    };
    response.render("./table.ejs", data);  
  }else{
    response.sendFile(__dirname + "/views/index.html");  
  }
  
  
  
  
});

// 部屋
app.post("/", (request, response) => {
  var table_id = crypto
    .createHash("md5")
    .update(request.body.table_name)
    .digest("hex");

  var data = {
    user_name: request.body.user_name,
    table_id: table_id,
    table_name: request.body.table_name
  };
  // レンダリングを行う
  response.render("./table.ejs", data);
  // response.sendFile(__dirname + "/views/table.html");
});

// ファイル置き場
app.use(express.static("public"));

// リッスン開始
server.listen(port, function() {
  console.log("Server listening at port %d", port);
});

// ソケットの設定
io.on("connection", function(socket) {
  // ---- multi room ----
  socket.on("enter", function(roomname) {
    socket.join(roomname);
    console.log("id=" + socket.id + " enter room=" + roomname);
    setRoomname(roomname);
  });

  function setRoomname(room) {
    socket.roomname = room;
  }

  function getRoomname() {
    var room = socket.roomname;
    return room;
  }

  function emitMessage(type, message) {
    // ----- multi room ----
    var roomname = getRoomname();

    if (roomname) {
      //console.log('===== message broadcast to room -->' + roomname);
      socket.broadcast.to(roomname).emit(type, message);
    } else {
      console.log("===== message broadcast all");
      socket.broadcast.emit(type, message);
    }
  }

  // When a user send a SDP message
  // broadcast to all users in the room
  socket.on("message", function(message) {
    var date = new Date();
    message.from = socket.id;
    //console.log(date + 'id=' + socket.id + ' Received Message: ' + JSON.stringify(message));

    // get send target
    var target = message.sendto;
    if (target) {
      //console.log('===== message emit to -->' + target);
      socket.to(target).emit("message", message);
      return;
    }

    // broadcast in room
    emitMessage("message", message);
  });

  // When the user hangs up
  // broadcast bye signal to all users in the room
  socket.on("disconnect", function() {
    // close user connection
    console.log(new Date() + " Peer disconnected. id=" + socket.id);

    // --- emit ----
    emitMessage("user disconnected", { id: socket.id });

    // --- leave room --
    var roomname = getRoomname();
    if (roomname) {
      socket.leave(roomname);
    }
  });

  // チャットメッセージの配信
  socket.on("chat", function(message) {
    console.log(" chat send. socket.id= " + socket.id + "message= " + message);
    message.from = socket.id;

    // broadcast in room
    emitMessage("chat", message);
  });

  // ログインメッセージの配信
  socket.on("alert", function(message) {
    message.from = socket.id;

    // broadcast in room
    emitMessage("alert", message);
  });

  // PINGの配信
  socket.on("being", function(message) {
    //message.from = socket.id;
    console.log("being received. " + message);
    emitMessage("being", message);
  });
});
