// SSL版・エクスプレスサーバ・ソケットサーバの基本設定
// SSL準備
var fs = require("fs");
var ssl_server_key = "/etc/letsencrypt/live/www.aice.cloud/privkey.pem";
var ssl_server_crt = "/etc/letsencrypt/live/www.aice.cloud/fullchain.pem";
var options = {
  key: fs.readFileSync(ssl_server_key),
  cert: fs.readFileSync(ssl_server_crt),
};
var express = require("express");
var app = express();
var server = require("https").createServer(options, app);
var io = require("socket.io")(server);
var port = process.env.PORT || 8443;

// テンプレートエンジン
app.set("view engine", "ejs");

app.set("views", __dirname + "/views");
app.set("public", __dirname + "/public");

// POSTにも対応
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Sequelize（DBアクセス）
let db = require('./models/index');

// ハッシュライブラリ
const crypto = require("crypto");

/*
// 暗号化・複合化ライブラリ
// 暗号の強度はほとんど問題にしていないため、適当なものにしています
var CryptoJS = require("crypto-js");
const CRYPTO_KEY = "MariariIs0urJustice";

function executeEncrypt(text) {
  var words = CryptoJS.enc.Utf8.parse(text); // WordArray object
  console.log("words");
  var base64 = CryptoJS.enc.Base64.stringify(words); // string: 'SGVsbG8gd29ybGQ='
  console.log("base64");
  return base64;
  // return CryptoJS.AES.encrypt(word, CRYPTO_KEY).toString();
}
function executeDecrypt(base64) {
  var words = CryptoJS.enc.Base64.parse(base64);
  var textString = CryptoJS.enc.Utf8.stringify(words); // 'Hello world'
  return textString;
  // return CryptoJS.AES.decrypt(word, CRYPTO_KEY).toString(CryptoJS.enc.Utf8);
}
*/

/**
 * ****************************************************
 * ルーティング
 * ****************************************************
 */
// 会議チャットトップ
app.get("/old", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

// AIFORUS用トップ
app.get("/aiforus", (request, response) => {
  response.sendFile(__dirname + "/views/index_aiforus.html");
});

// デモ用トップ
app.get("/demo", (request, response) => {
  response.sendFile(__dirname + "/views/index_demo.html");
});

// 会議部屋
app.post("/old", (request, response) => {
  var table_id = crypto
    .createHash("md5")
    .update(request.body.table_name)
    .digest("hex");

  var data = {
    user_name: request.body.user_name,
    table_id: table_id,
    table_name: request.body.table_name,
  };
  // レンダリングを行う
  response.render("./room_mtg.ejs", data);
});


/**
 * **************************************
 * 新デザインルーティング
 * **************************************
 */

/**
 * 会議室作成ページ
 */
app.get("/create", (request, response) => {
  
  // 今回の仕様だと、ejsでやる必要ないけど一応残しときます
  var data = {
    room_name: "",
    password: "",
  };
  // response.sendFile(__dirname + "/views/index_renew.html");
  response.render("./index_renew.ejs", data);
});

/**
 * 招待ログインページ
 */
app.get("/", async(request, response) => {
  const param = request.query.secret;
  try {

    db.room.findOne({
      secret: secret
    }).then((room) => {

      // 会議室ページへ遷移
      var data = {
        secret: secret,
        room_name: room.room_name,
      };
      response.render("./index_renew_invited.ejs", data);
    });

  } catch {
    // エラー時は何事もなくカラで表示
    var data = {
      secret: "",
      room_name: "",
    };
  }
  response.render("./index_renew_invited.ejs", data);
});

/**
 * 会議室ページ
 */
app.post("/", async(request, response) => {

  var room_name = request.body.room_name;
  var user_name = request.body.user_name;
  var secret = request.body.secret;
  var mode = request.body.mode;

  try{
    // 新規登録モードの時
    if(mode == "create"){

      // ルームを新規作成して遷移
      pw = Math.floor(Math.random() * 10000000);
  
      secret = crypto
        .createHash("md5")
        .update(room_name + pw)
        .digest("hex");

      // DBに新規登録
      db.room.create({
        room_name: room_name,
        secret: secret,
      }).then((createdUser) => {

        // 会議室ページへ遷移
        var data = {
          user_name: user_name,
          room_id: secret,
          room_name: room_name,
        };
      response.render("./room_mtg_renew.ejs", data);
      });
      
    }else{
      // 招待されたモードの時
      // ルームを照合して遷移
      db.room.findOne({
        secret: secret
      }).then((room) => {

        // 会議室ページへ遷移
        var data = {
          user_name: user_name,
          room_id: secret,
          room_name: room_name,
        };
        response.render("./room_mtg_renew.ejs", data);
      });
    }

  }catch(err){
    console.log(err)
    // エラーが起こったらとりあえず招待画面に飛ばす
    var data = {
      user_name: "",
      room_name: ""
    };
    response.render("./index_renew.ejs", data);
  }


  /*
  var pw;
  if (request.body.password) {
    pw = request.body.password;
  } else {
    pw = Math.floor(Math.random() * 10000000);
  }
  var room_id = crypto
    .createHash("md5")
    .update(request.body.room_name + pw)
    .digest("hex");

  var data = {
    user_name: request.body.user_name,
    room_id: room_id,
    room_name: request.body.room_name,
    password: pw,
  };
  */
  // レンダリングを行う
  response.render("./room_mtg_renew.ejs", data);
});

// ファイル置き場
app.use(express.static(__dirname + "/public"));

// リッスン開始
server.listen(port, function () {
  console.log("Server listening at port %d", port);
});

/**
 * ****************************************************
 * ソケットの設定
 * ****************************************************
 */
io.on("connection", function (socket) {
  // ---- multi room ----
  socket.on("enter", function (roomname) {
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
  socket.on("message", function (message) {
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
  socket.on("disconnect", function () {
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
  socket.on("chat", function (message) {
    console.log(" chat send. socket.id= " + socket.id + "message= " + message);
    message.from = socket.id;

    // broadcast in room
    emitMessage("chat", message);
  });

  // ログインメッセージの配信
  socket.on("alert", function (message) {
    message.from = socket.id;

    // broadcast in room
    emitMessage("alert", message);
  });

  // PINGの配信
  socket.on("being", function (message) {
    //message.from = socket.id;
    console.log("being received. " + message);
    emitMessage("being", message);
  });

  // マイク使用シグナルの配信
  socket.on("talkSignal", function (message) {
    emitMessage("talkSignal", message);
  });
  // マイクリリースシグナルの配信
  socket.on("releaseSignal", function (message) {
    emitMessage("releaseSignal", message);
  });

  // 退出シグナルの配信
  socket.on("leaveSignal", function (message) {
    emitMessage("leaveSignal", message);
  });

  // 投票シグナルの配信
  socket.on("vote", function (message) {
    emitMessage("vote", message);
  });
  // リンクパラメータの配信
  socket.on("roomhash", function (message) {
    var data = {
      room_name: message.room_name,
      password: message.password,
    };
    // const result = executeEncrypt(JSON.stringify(data));
    socket.emit("roomhash", data);
  });
});

// DBから部屋リストを取得
function getRoomList() {
  var data = [
    {
      roomname: "ロビー",
      membercount: "",
    },
    {
      roomname: "IT",
      membercount: "",
    },
    {
      roomname: "政治",
      membercount: "",
    },
    {
      roomname: "音楽",
      membercount: "",
    },
    {
      roomname: "アニメ",
      membercount: "",
    },
    {
      roomname: "旅行",
      membercount: "",
    },
    {
      roomname: "出会い",
      membercount: "",
    },
  ];
  return data;
} // DBから部屋リストを取得
function getRoomList2() {
  var data = {
    roomlist: [
      {
        roomname: "ロビー",
        membercount: "",
      },
      {
        roomname: "IT",
        membercount: "",
      },
      {
        roomname: "政治",
        membercount: "",
      },
      {
        roomname: "音楽",
        membercount: "",
      },
      {
        roomname: "アニメ",
        membercount: "",
      },
      {
        roomname: "旅行",
        membercount: "",
      },
      {
        roomname: "出会い",
        membercount: "",
      },
    ],
  };
  return data;
}
