// ==========================
//  FACE RECOGNITION SCRIPT
//  (FIXED STRUCTURE)
// ==========================

var labels = [];
let detectedFaces = [];
let sendingData = false;
let videoStream = null;
let modelsLoaded = false; // Moved to global scope

// ---------- Utility ----------
function showMessage(message) {
  const messageDiv = document.getElementById("messageDiv");
  if (!messageDiv) return;
  messageDiv.style.display = "block";
  messageDiv.innerHTML = message;
  messageDiv.style.opacity = 1;
  console.log(message);
  setTimeout(() => (messageDiv.style.opacity = 0), 5000);
}

// ---------- Attendance ----------
function markAttendance(detectedFaces) {
  document.querySelectorAll("#studentTableContainer tr").forEach((row) => {
    const registrationNumber = row.cells[0].innerText.trim();
    if (detectedFaces.includes(registrationNumber)) {
      row.cells[5].innerText = "present";
    }
  });
}

function sendAttendanceDataToServer() {
  const attendanceData = [];

  document.querySelectorAll("#studentTableContainer tr").forEach((row, i) => {
    if (i === 0) return;
    const studentID = row.cells[0].innerText.trim();
    const course = row.cells[2].innerText.trim();
    const unit = row.cells[3].innerText.trim();
    const attendanceStatus = row.cells[5].innerText.trim();
    attendanceData.push({ studentID, course, unit, attendanceStatus });
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "handle_attendance", true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response.status === "success") {
            showMessage(response.message || "Attendance recorded successfully.");
          } else {
            showMessage(
              response.message ||
                "An error occurred while recording attendance."
            );
          }
        } catch (e) {
          console.error(e);
          showMessage("Error: Failed to parse the response from the server.");
        }
      } else {
        console.error("HTTP Error", xhr.status, xhr.statusText);
        showMessage(
          "Error: Unable to record attendance. HTTP Status: " + xhr.status
        );
      }
    }
  };
  xhr.send(JSON.stringify(attendanceData));
}

// ---------- Webcam control ----------
function stopWebcam() {
  const video = document.getElementById("video"); // Need video reference here
  if (videoStream) {
    const tracks = videoStream.getTracks();
    tracks.forEach((track) => track.stop());
    video.srcObject = null;
    videoStream = null;
  }
}

// ------------------------------------------------------------------
// 🔥 STARTUP LOGIC: RUNS ON PAGE LOAD TO INITIALIZE MODELS & BUTTONS 🔥
// ------------------------------------------------------------------

async function startWebcam() {
  const video = document.getElementById("video");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    video.srcObject = stream;
    videoStream = stream;
    console.log("Webcam started successfully!");
  } catch (error) {
    console.error("Webcam error:", error);
    alert("Could not access webcam. Check your permissions.");
  }
}

// Function to handle the recognition processing loop
async function setupFaceRecognitionLoop() {
  const video = document.getElementById("video");
  const videoContainer = document.querySelector(".video-container");

  const labeledFaceDescriptors = await getLabeledFaceDescriptions();
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
  const canvas = faceapi.createCanvasFromMedia(video);

  // Remove existing canvas before appending a new one to prevent duplication
  const existingCanvas = videoContainer.querySelector('canvas');
  if(existingCanvas) existingCanvas.remove();
  
  videoContainer.appendChild(canvas);
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map((d) =>
      faceMatcher.findBestMatch(d.descriptor)
    );
    detectedFaces = results.map((r) => r.label);
    markAttendance(detectedFaces);

    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, { label: result });
      drawBox.draw(canvas);
    });
  }, 100);
}

// Function that was previously inside updateOtherElements()
async function getLabeledFaceDescriptions() {
  const labeledDescriptors = [];
  for (const label of labels) {
    const descriptions = [];
    for (let i = 1; i <= 5; i++) {
      try {
        const img = await faceapi.fetchImage(
          `resources/labels/${label}/${i}.png`
        );
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detections) {
          descriptions.push(detections.descriptor);
        } else {
          console.log(`No face detected in ${label}/${i}.png`);
        }
      } catch (error) {
        console.error(`Error processing ${label}/${i}.png:`, error);
      }
    }
    if (descriptions.length > 0) {
      labeledDescriptors.push(
        new faceapi.LabeledFaceDescriptors(label, descriptions)
      );
    }
  }
  return labeledDescriptors;
}

// This function is now DEPRECATED. Its code has been moved to DOMContentLoaded.
function updateOtherElements() { 
  console.warn("updateOtherElements() is deprecated and should not be called.");
} 

// ---------- Update student table ----------
function updateTable() {
  const selectedCourseID = document.getElementById("courseSelect").value;
  const selectedunitCode = document.getElementById("unitSelect").value;
  const selectedVenue = document.getElementById("venueSelect").value;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "resources/pages/lecture/manageFolder.php", true);
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      try {
        const response = JSON.parse(xhr.responseText);
        if (response.status === "success") {
          labels = response.data; // Update the global labels list
          // Removed updateOtherElements() call here, setup is global
          document.getElementById("studentTableContainer").innerHTML =
            response.html;
        } else {
          console.error("Error:", response.message);
        }
      } catch (err) {
        console.error("JSON parse error:", err);
      }
    } else if (xhr.readyState === 4 && xhr.status !== 200) {
      console.error(`AJAX Error: ${xhr.status} ${xhr.statusText}`);
    }
  };


  xhr.send(
    `courseID=${encodeURIComponent(selectedCourseID)}&unitID=${encodeURIComponent(selectedunitCode)}&venueID=${encodeURIComponent(selectedVenue)}`
  );
}

// ---------- End attendance ----------
document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ DOM loaded, running global setup.");

  const startButton = document.getElementById("startButton");
  const videoContainer = document.querySelector(".video-container");
  let webcamStarted = false;

  // 1. Load Models FIRST (runs only once)
  Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri("models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("models"),
  ])
    .then(() => {
      modelsLoaded = true;
      console.log("Models loaded successfully.");
    })
    .catch((error) => {
      console.error("Model Loading Error:", error);
      alert("Face-API models failed to load. Check model folder.");
    });

  // 2. Setup Webcam Startup Listener
  if (startButton) {
    startButton.addEventListener("click", async () => {
      if (!modelsLoaded) {
        alert("Face-API models are still loading. Please wait a moment.");
        return;
      }
      
      videoContainer.style.display = "flex";
      if (!webcamStarted) {
        await startWebcam();
        webcamStarted = true;
      }
    });
  }
  
  // 3. Setup Face Recognition Loop Start (after video plays)
  const video = document.getElementById("video");
  if(video) {
    video.addEventListener("play", setupFaceRecognitionLoop);
  }

  // 4. Setup End Button Listener
  const endBtn = document.getElementById("endAttendance");
  if (endBtn) {
    endBtn.addEventListener("click", function () {
      sendAttendanceDataToServer();
      videoContainer.style.display = "none";
      stopWebcam();
      webcamStarted = false; // Reset state
      video.removeEventListener("play", setupFaceRecognitionLoop); // Stop interval
    });
  }
});