function _assert(desc, v) {
  if (v) {
    return;
  } else {
    let caller = _assert.caller || "Top level";
    console.error("ASSERT in %s, %s is :", caller, desc, v);
  }
}

// デバイスのメディアにアクセス
let localVideo = document.getElementById("local_video");
let localStream = null;

// 複数接続用にピアコネクションの準備
let peerConnections = [];
let remoteVideos = [];
const MAX_CONNECTION_COUNT = 20;

// --- multi video ---
let container = document.getElementById("container");
_assert("container", container);

// --- prefix -----
navigator.getUserMedia =
  navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;
RTCPeerConnection =
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection;
RTCSessionDescription =
  window.RTCSessionDescription ||
  window.webkitRTCSessionDescription ||
  window.mozRTCSessionDescription;

// ----------------------------------------------------------------
// ---------------------- SOCKET.IOの設定  -----------------------
// ----------------------------------------------------------------

// ----- use socket.io ---
let port = 3000;
let socket = io();
let room = getRoomName();

socket.on("connect", function (evt) {
  console.log("socket.io connected. enter room=" + room);
  socket.emit("enter", room);
});
socket.on("message", function (message) {
  console.log("message:", message);
  let fromId = message.from;

  if (message.type === "offer") {
    // -- got offer ---
    console.log("Received offer ...");
    let offer = new RTCSessionDescription(message);
    setOffer(fromId, offer);
  } else if (message.type === "answer") {
    // --- got answer ---
    console.log("Received answer ...");
    let answer = new RTCSessionDescription(message);
    setAnswer(fromId, answer);
  } else if (message.type === "candidate") {
    // --- got ICE candidate ---
    console.log("Received ICE candidate ...");
    let candidate = new RTCIceCandidate(message.ice);
    console.log(candidate);
    addIceCandidate(fromId, candidate);
  } else if (message.type === "call me") {
    if (!isReadyToConnect()) {
      console.log("Not ready to connect, so ignore");
      return;
    } else if (!canConnectMore()) {
      console.warn("TOO MANY connections, so ignore");
    }

    if (isConnectedWith(fromId)) {
      // already connnected, so skip
      console.log("already connected, so ignore");
    } else {
      // connect new party
      makeOffer(fromId);
    }
  } else if (message.type === "bye") {
    if (isConnectedWith(fromId)) {
      stopConnection(fromId);
    }
  }
});
socket.on("user disconnected", function (evt) {
  console.log("====user disconnected==== evt:", evt);
  let id = evt.id;
  if (isConnectedWith(id)) {
    stopConnection(id);
  }
});

socket.on("chat", function (msg) {
  // $("#chat").append($("<li>").text(msg));
  chatVue.addContent(msg);
});

socket.on("alert", function (msg) {
  toastr.success(msg);
  $("#se").get(0).play();
});

socket.on("being", function (msg) {
  var text = msg;
  const words = text.split("---");
  // 名前欄を更新する
  if ($("#user_name_" + words[1]).text() !== words[0]) {
    $("#user_name_" + words[1]).text(words[0]);
  }
  // メンバー一覧を更新する
  memberVue.updateMemberList(msg);
});

socket.on("sharereq", function (msg) {
  alert(msg.from);
  stopConnection(msg.from);
});

// --- broadcast message to all members in room
function emitRoom(msg) {
  socket.emit("message", msg);
}

function emitTo(id, msg) {
  msg.sendto = id;
  socket.emit("message", msg);
}

// -- room名を取得 --
function getRoomName() {
  /* パラメータで指定する場合
      let url = document.location.href;
      let args = url.split("?");
      if (args.length > 1) {
        let room = args[1];
        if (room != "") {
          console.log("RoomName:" + room);
          return room;
        }
      }
      return "_testroom";
      */

  // 埋め込みで指定する場合
  let args = $("#table_id").val();
  if (args == "") {
    return "_testroom";
  }
  return args;
}

// ---- for multi party -----
function isReadyToConnect() {
  if (localStream) {
    return true;
  } else {
    return false;
  }
}

// --- RTCPeerConnections ---
function getConnectionCount() {
  return peerConnections.length;
}

function canConnectMore() {
  return getConnectionCount() < MAX_CONNECTION_COUNT;
}

function isConnectedWith(id) {
  if (peerConnections[id]) {
    return true;
  } else {
    return false;
  }
}

function addConnection(id, peer) {
  _assert("addConnection() peer", peer);
  _assert("addConnection() peer must NOT EXIST", !peerConnections[id]);
  peerConnections[id] = peer;
}

function getConnection(id) {
  let peer = peerConnections[id];
  _assert("getConnection() peer must exist", peer);
  return peer;
}

function deleteConnection(id) {
  _assert("deleteConnection() peer must exist", peerConnections[id]);
  delete peerConnections[id];
}

function stopConnection(id) {
  detachVideo(id);

  if (isConnectedWith(id)) {
    let peer = getConnection(id);
    peer.close();
    deleteConnection(id);
  }
}

function stopAllConnection() {
  for (let id in peerConnections) {
    stopConnection(id);
  }
}

// ----------------------------------------------------------------
// ---------------------- ビデオ要素の管理  -----------------------
// ----------------------------------------------------------------

// --- video elements ---
function attachVideo(id, stream) {
  let video = addRemoteVideoElement(id);
  playVideo(video, stream);
  video.volume = 1.0;

  $("#remote_video_" + id).wrap(
    '<div class="videowrapper" id="video_container_' + id + '"/>'
  );
  $("#remote_video_" + id).after(
    '<p class="membername" id="user_name_' + id + '">　</p>'
  );
  videoVue.editVideoClass();
}

function detachVideo(id) {
  let video = getRemoteVideoElement(id);
  pauseVideo(video);
  deleteRemoteVideoElement(id);

  // $('#remote_video_'+id).remove();
  $("#video_container_" + id).remove();

  // ビデオ数をカウントダウン
  videoVue.removeVideoCount();

  // ダミービデオ要素を追加
  // addBlankVideoElement();

  videoVue.editVideoClass();
}

function isRemoteVideoAttached(id) {
  if (remoteVideos[id]) {
    return true;
  } else {
    return false;
  }
}

function addRemoteVideoElement(id) {
  _assert("addRemoteVideoElement() video must NOT EXIST", !remoteVideos[id]);
  let video = createVideoElement("remote_video_" + id);
  remoteVideos[id] = video;
  return video;
}

function getRemoteVideoElement(id) {
  let video = remoteVideos[id];
  _assert("getRemoteVideoElement() video must exist", video);
  return video;
}

function deleteRemoteVideoElement(id) {
  _assert("deleteRemoteVideoElement() stream must exist", remoteVideos[id]);
  //removeVideoElement("remote_video_" + id);
  removeVideoWrapperElement("video_container_" + id);
  delete remoteVideos[id];
}

function createVideoElement(elementId) {
  // ダミービデオを一つ削除
  // removeBlankVideoElement();

  // ビデオ数をカウントアップ
  videoVue.addVideoCount();

  // ビデオ要素を作成
  let video = document.createElement("video");
  video.id = elementId;
  video.className = "membersvideo";
  container.prepend(video);
  return video;
}

// 元の処理
function removeVideoElement(elementId) {
  let video = document.getElementById(elementId);
  _assert("removeVideoElement() video must exist", video);

  container.removeChild(video);
  return video;
}

// DIVでラップしてるので、DIVごと削除
function removeVideoWrapperElement(elementId) {
  let wrapper = document.getElementById(elementId);
  _assert("removeVideoWrapperElement() video must exist", wrapper);

  //container.remove(wrapper);
  $("#" + elementId).remove();
}

// ダミーのビデオを削除する
// function removeBlankVideoElement(){
//   $(".blankVideo")[0].remove();
// }

// ダミーのビデオを追加する
// function addBlankVideoElement(){
//   $('#container').append('<div class="col-3 col-12-small blankVideo" ><img src="/assets/images/dummy.png" class="dummyvideo"/></div>');
// }

// function

// ----------------------------------------------------------------
// ---------------------- ボタン操作  -----------------------
// ----------------------------------------------------------------

// connect video
function connectVideo() {
  var videoParam = {
    audio: true,
    video: {
      width: 640,
      height: 480,
      frameRate: { ideal: 10, max: 15 },
    },
  };
  getDeviceStream(videoParam) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function (stream) {
      // success

      // 取得したメディア情報をぶち込む
      localStream = stream;

      // 自分のビデオを再生する
      playVideo(localVideo, stream);

      // ビデオ・音声の送信をポーズ
      stopVideo();
      stopVoice();

      connect();
    })
    .catch(function (error) {
      // error
      console.error("getUserMedia error:", error);
      return;
    });
  return false;
}

function setCaptureVideo() {
  var videoParam = {
    audio: true,
    video: {
      frameRate: { ideal: 10, max: 15 },
    },
  };
  navigator.mediaDevices
    .getDisplayMedia(videoParam)
    .then((stream) => {
      localStream.removeTrack(localStream.getVideoTracks()[0]);

      localStream.addTrack(stream.getVideoTracks()[0]);
      playVideo(localVideo, stream);

      connect();
    })
    .catch((error) => {
      console.error("getDisplayMedia error:", error);
      return;
    });
}
function setCameraVideo() {
  var videoParam = {
    audio: true,
    video: {
      width: 640,
      height: 480,
      frameRate: { ideal: 10, max: 15 },
    },
  };
  getDeviceStream(videoParam)
    .then((stream) => {
      localStream = stream;
      playVideo(localVideo, stream);
    })
    .catch((error) => {
      console.error("getDisplayMedia error:", error);
      return;
    });
}

/*
// start local video
function startVideo() {
  getDeviceStream({ video: true, audio: true }) // audio: false <-- ontrack once, audio:true --> ontrack twice!!
    .then(function (stream) {
      // success
      localStream = stream;
      playVideo(localVideo, stream);

      // ボタンの表示を切り替え
      $("#startbutton").addClass("hidden");
      $("#stopbutton").removeClass("hidden");

      connect();
    })
    .catch(function (error) {
      // error
      console.error("getUserMedia error:", error);
      return;
    });
  return false;
}

// stop local video
function stopVideo() {
  pauseVideo(localVideo);
  stopLocalStream(localStream);

  // ボタンの表示を切り替え
  $("#startbutton").removeClass("hidden");
  $("#stopbutton").addClass("hidden");

  return false;
}
*/

/*
// ビデオON/OFFボタン（テスト）
function startVideo_() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });
  $("#stopbutton").removeClass("hidden");
  $("#startbutton").addClass("hidden");
}
function stopVideo_() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
  // stopLocalStream(localStream);
  $("#startbutton").removeClass("hidden");
  $("#stopbutton").addClass("hidden");
}
*/

//
function sendChat() {
  if ($("#input_msg").val().length == 0) {
    toastr.error("文字を入力してください");
  } else {
    var text = $("#user_name").val() + " : " + $("#input_msg").val();
    //$("#chat").append($("<li>").text(text));
    socket.emit("chat", text);

    chatVue.addContent(text);
    $("#input_msg").val("");
  }

  return false;
}

function sendBeing() {
  var message = $("#user_name").val() + "---" + socket.id;
  socket.emit("being", message);
  return false;
}

function stopLocalStream(stream) {
  let tracks = stream.getTracks();
  if (!tracks) {
    console.warn("NO tracks");
    return;
  }

  for (let track of tracks) {
    track.stop();
  }
}

function getDeviceStream(option) {
  if ("getUserMedia" in navigator.mediaDevices) {
    console.log("navigator.mediaDevices.getUserMadia");
    return navigator.mediaDevices.getUserMedia(option);
  } else {
    console.log("wrap navigator.getUserMadia with Promise");
    return new Promise(function (resolve, reject) {
      navigator.getUserMedia(option, resolve, reject);
    });
  }
}

function playVideo(element, stream) {
  if ("srcObject" in element) {
    element.srcObject = stream;
  } else {
    element.src = window.URL.createObjectURL(stream);
  }
  element.play();
  element.volume = 0;
}

function pauseVideo(element) {
  element.pause();
  if ("srcObject" in element) {
    //element.srcObject = null;
  } else {
    if (element.src && element.src !== "") {
      window.URL.revokeObjectURL(element.src);
    }
    element.src = "";
  }
}

/*--
  // ----- hand signaling ----
  function onSdpText() {
    let text = textToReceiveSdp.value;
    if (peerConnection) {
      console.log('Received answer text...');
      let answer = new RTCSessionDescription({
        type : 'answer',
        sdp : text,
      });
      setAnswer(answer);
    }
    else {
      console.log('Received offer text...');
      let offer = new RTCSessionDescription({
        type : 'offer',
        sdp : text,
      });
      setOffer(offer);
    }
    textToReceiveSdp.value ='';
  }
  --*/

function sendSdp(id, sessionDescription) {
  console.log("---sending sdp ---");
  let message = {
    type: sessionDescription.type,
    sdp: sessionDescription.sdp,
  };
  console.log("sending SDP=" + message);
  //ws.send(message);
  emitTo(id, message);
}

function sendIceCandidate(id, candidate) {
  console.log("---sending ICE candidate ---");
  let obj = { type: "candidate", ice: candidate };
  if (isConnectedWith(id)) {
    emitTo(id, obj);
  } else {
    console.warn("connection NOT EXIST or ALREADY CLOSED. so skip candidate");
  }
}

// ----------------------------------------------------------------
// ---------------------- ピアコネクションの管理  -----------------------
// ----------------------------------------------------------------
function prepareNewConnection(id) {
  // ネットワーク超えする場合
  let pc_config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
    ],
  };
  let peer = new RTCPeerConnection(pc_config);

  // ローカルネットワークのみの場合
  // let pc_config = { iceServers: [] };
  // let peer = new RTCPeerConnection(pc_config);

  // --- on get remote stream ---
  if ("ontrack" in peer) {
    peer.ontrack = function (event) {
      let stream = event.streams[0];
      console.log("-- peer.ontrack() stream.id=" + stream.id);
      if (isRemoteVideoAttached(id)) {
        console.log("stream already attached, so ignore");
      } else {
        //playVideo(remoteVideo, stream);
        attachVideo(id, stream);
      }
    };
  } else {
    peer.onaddstream = function (event) {
      let stream = event.stream;
      console.log("-- peer.onaddstream() stream.id=" + stream.id);
      //playVideo(remoteVideo, stream);
      attachVideo(id, stream);
    };
  }

  // --- on get local ICE candidate
  peer.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log(evt.candidate);

      // Trickle ICE の場合は、ICE candidateを相手に送る
      sendIceCandidate(id, evt.candidate);

      // Vanilla ICE の場合には、何もしない
    } else {
      console.log("empty ice event");

      // Trickle ICE の場合は、何もしない

      // Vanilla ICE の場合には、ICE candidateを含んだSDPを相手に送る
      //sendSdp(id, peer.localDescription);
    }
  };

  // --- when need to exchange SDP ---
  peer.onnegotiationneeded = function (evt) {
    console.log("-- onnegotiationneeded() ---");
  };

  // --- other events ----
  peer.onicecandidateerror = function (evt) {
    console.error("ICE candidate ERROR:", evt);
  };

  peer.onsignalingstatechange = function () {
    console.log("== signaling status=" + peer.signalingState);
  };

  peer.oniceconnectionstatechange = function () {
    console.log("== ice connection status=" + peer.iceConnectionState);
    if (peer.iceConnectionState === "disconnected") {
      console.log("-- disconnected --");
      stopConnection(id);
    }
  };

  peer.onicegatheringstatechange = function () {
    console.log("==***== ice gathering state=" + peer.iceGatheringState);
  };

  peer.onconnectionstatechange = function () {
    console.log("==***== connection state=" + peer.connectionState);
  };

  peer.onremovestream = function (event) {
    console.log("-- peer.onremovestream()");
    deleteRemoteStream(id);
    detachVideo(id);
  };

  // -- add local stream --
  if (localStream) {
    console.log("Adding local stream...");
    peer.addStream(localStream);
  } else {
    console.warn("no local stream, but continue.");
  }

  return peer;
}

function makeOffer(id) {
  _assert("makeOffer must not connected yet", !isConnectedWith(id));
  peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .createOffer()
    .then(function (sessionDescription) {
      console.log("createOffer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setOffer(id, sessionDescription) {
  _assert("setOffer must not connected yet", !isConnectedWith(id));
  let peerConnection = prepareNewConnection(id);
  addConnection(id, peerConnection);

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(offer) succsess in promise");
      makeAnswer(id);
    })
    .catch(function (err) {
      console.error("setRemoteDescription(offer) ERROR: ", err);
    });
}

function makeAnswer(id) {
  console.log("sending Answer. Creating remote session description...");
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .createAnswer()
    .then(function (sessionDescription) {
      console.log("createAnswer() succsess in promise");
      return peerConnection.setLocalDescription(sessionDescription);
    })
    .then(function () {
      console.log("setLocalDescription() succsess in promise");

      // -- Trickle ICE の場合は、初期SDPを相手に送る --
      sendSdp(id, peerConnection.localDescription);

      // -- Vanilla ICE の場合には、まだSDPは送らない --
    })
    .catch(function (err) {
      console.error(err);
    });
}

function setAnswer(id, sessionDescription) {
  let peerConnection = getConnection(id);
  if (!peerConnection) {
    console.error("peerConnection NOT exist!");
    return;
  }

  peerConnection
    .setRemoteDescription(sessionDescription)
    .then(function () {
      console.log("setRemoteDescription(answer) succsess in promise");
    })
    .catch(function (err) {
      console.error("setRemoteDescription(answer) ERROR: ", err);
    });
}

// --- tricke ICE ---
function addIceCandidate(id, candidate) {
  if (!isConnectedWith(id)) {
    console.warn(
      "NOT CONNEDTED or ALREADY CLOSED with id=" + id + ", so ignore candidate"
    );
    return;
  }

  let peerConnection = getConnection(id);
  if (peerConnection) {
    peerConnection.addIceCandidate(candidate);
  } else {
    console.error("PeerConnection not exist!");
    return;
  }
}

// start PeerConnection
function connect() {
  console.log("connect sequence start.");
  if (!isReadyToConnect()) {
    console.warn("NOT READY to connect");
  } else if (!canConnectMore()) {
    console.log("TOO MANY connections");
  } else {
    callMe();
  }
}

// close PeerConnection
function hangUp() {
  emitRoom({ type: "bye" });
  stopAllConnection();
}

// ---- multi party --
function callMe() {
  emitRoom({ type: "call me" });
}

/**
 * 画面遷移時
 */
window.onload = function () {
  var today = new Date();
  var hour = today.getHours();
  var minut = today.getMinutes();
  var textdate = hour + "：" + minut;

  var text = $("#user_name").val() + "さんが参加しました。（" + textdate + "）";
  socket.emit("alert", text);
  socket.emit("chat", text);

  var systemmesage =
    "ようこそ" + $("#user_name").val() + "さん。（" + textdate + "）";
  chatVue.addContent(systemmesage);

  setInterval(function () {
    sendBeing();
  }, 5000);

  // autoScroll();

  connectVideo();
};

$("#chatToggle").on("click", function () {
  $("#chatSlide").slideToggle();
});

function copyToClipboard() {
  // コピー対象をJavaScript上で変数として定義する
  var copyTarget = document.getElementById("copyTarget");

  // コピー対象のテキストを選択する
  copyTarget.select();

  // 選択しているテキストをクリップボードにコピーする
  document.execCommand("Copy");

  // コピーをお知らせする
  alert("コピーできました！ : " + copyTarget.value);
}

// オートスクロール
var scrollY = 0;
function autoScroll() {
  var sampleBox = document.getElementById("chat-container");
  sampleBox.scrollTop = scrollY + 1;
  if (scrollY < sampleBox.scrollHeight - sampleBox.clientHeight) {
    setTimeout("autoScroll()", 20);
  } else {
    scrollY = 0;
    sampleBox.scrollTop = 0;
    setTimeout("autoScroll()", 20);
  }
}

function jumpOtherRoom(roomname) {
  const param = {
    table_name: roomname,
    user_name: $("#user_name").val(),
  };
  execPost("", param);
}

/**
 * データをPOSTする
 * @param String アクション
 * @param Object POSTデータ連想配列
 * 記述元Webページ http://fujiiyuuki.blogspot.jp/2010/09/formjspost.html
 * サンプルコード
 * <a onclick="execPost('/hoge', {'fuga':'fuga_val', 'piyo':'piyo_val'});return false;" href="#">POST送信</a>
 */
function execPost(action, data) {
  // フォームの生成
  var form = document.createElement("form");
  form.setAttribute("action", action);
  form.setAttribute("method", "post");
  form.style.display = "none";
  document.body.appendChild(form);
  // パラメタの設定
  if (data !== undefined) {
    for (var paramName in data) {
      var input = document.createElement("input");
      input.setAttribute("type", "hidden");
      input.setAttribute("name", paramName);
      input.setAttribute("value", data[paramName]);
      form.appendChild(input);
    }
  }
  // submit
  form.submit();
}

// ----------------------------------------------------------------
// ---------------------- ボタン操作 --------------------------------
// ----------------------------------------------------------------

/**
 * イベントリスナ
 */

$("#videobutton").on("click", () => {
  toggleVideo();
});

$("#micbutton").on("click", () => {
  toggleMic();
});

$("#capturebutton").on("click", () => {
  toggleInput();
});
$("#recordbutton").on("click", () => {
  alert("Now developing...");
});
$("#goodbutton").on("click", () => {
  alert("Now developing...");
});
$("#badbutton").on("click", () => {
  alert("Now developing...");
});
$("#calendarbutton").on("click", () => {
  alert("Now developing...");
});
$("#bgchangebutton").on("click", () => {
  alert("Now developing...");
});
$("#leavebutton").on("click", () => {
  // alert("Now developing...");
  socket.emit("sharereq", "");
});

function toggleVideo() {
  localStream.getVideoTracks().forEach((track) => {
    if (track.enabled == true) {
      stopVideo();
      $("#videobutton").removeClass("fab-on");
    } else {
      startVideo();
      $("#videobutton").addClass("fab-on");
    }
  });
}

function toggleMic() {
  var tracks = localStream.getAudioTracks();
  if (tracks[0].enabled) {
    stopVoice();
    $("#micbutton").removeClass("fab-on");
  } else {
    startVoice();
    $("#micbutton").addClass("fab-on");
  }
}

function startVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });
  $("#stopbutton").removeClass("hidden");
  $("#startbutton").addClass("hidden");
}

function stopVideo() {
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
  // stopLocalStream(localStream);
  $("#startbutton").removeClass("hidden");
  $("#stopbutton").addClass("hidden");
}

// マイクON/OFF
function startVoice() {
  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = true;
}
function stopVoice() {
  var tracks = localStream.getAudioTracks();
  tracks[0].enabled = false;
}

function toggleInput() {
  if ($("#capturebutton").hasClass("fab-on")) {
    setCameraVideo();
    $("#capturebutton").removeClass("fab-on");
  } else {
    toastr.info(
      "※初めて画面共有をする場合は、ブラウザ再起動が必要な場合があります。"
    );
    setCaptureVideo();
    $("#capturebutton").addClass("fab-on");
  }
}
