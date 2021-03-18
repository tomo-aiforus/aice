"use strict";

// const localVideo = document.getElementById("local");
// const recordedVideo = document.getElementById("recorded");
// const startBtn = document.getElementById("start");
// const recordBtn = document.getElementById("record");
// const playBtn = document.getElementById("play");
// const downloadBtn = document.getElementById("download");
let mediaRecorder;
let recordedBlobs;

function getLocalMediaStream(mediaStream) {
  // recordBtn.disabled = false;
  // const localStream = mediaStream;
  // localVideo.srcObject = mediaStream;
  window.stream = mediaStream;

  startRecording()
}

function handleLocalMediaStreamError(error) {
  console.log(`navigator.getUserMedia error: ${error}`);
}

function handleDataAvailable(event) {
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function startRecording() {
  recordedBlobs = [];
  const options = { mimeType: "video/webm;codecs=vp9" };

  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (error) {
    console.log(`Exception while creating MediaRecorder: ${error}`);
    return;
  }

  console.log("Created MediaRecorder", mediaRecorder);
  // recordBtn.textContent = "録画停止";
  // playBtn.disabled = true;
  // downloadBtn.disabled = true;

  mediaRecorder.onstop = event => {
    console.log("Recorder stopped: ", event);
  };

  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start(10);
  console.log("MediaRecorder started", mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
  console.log("Recorded media.");
}

async function startCapture() {
  /*
  const constraints = {
    video: {
      width: 1280,
      height: 720
    }
  };
  navigator.mediaDevices
    .getDisplayMedia(constraints)
    .then((str) => getLocalMediaStream(str))
    .catch(handleLocalMediaStreamError);
  */
  
  var combinedStream = new MediaStream()
  navigator.mediaDevices.getDisplayMedia({
    video: {
      width: 1280,
      height: 720
    },
    audio: true
  }).then((ds) => {
    combinedStream.addTrack(ds.getTracks()[0])
    combinedStream.addTrack(ds.getTracks()[1])

      navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true
      }).then((us) => {
        combinedStream.addTrack(us.getTracks()[0])
        getLocalMediaStream(combinedStream)
      })
    
  })

};

$("#recordbutton").on("click", () => {
  toggleRecord()
});
function toggleRecord() {
  if ($("#recordbutton").hasClass("fab-on")) {
    $("#recordbutton").removeClass("fab-on");
    stopRecording();
    download();
  } else {
    $("#recordbutton").addClass("fab-on");
    startCapture();
  }
}

function download(){
  const blob = new Blob(recordedBlobs, { type: "video/webm" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "rec.webm";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
};
