import os
import cv2
import mediapipe as mp
from flask import Flask, request, jsonify, send_file
from werkzeug.utils import secure_filename
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)

CORS(app)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Initialize MediaPipe Pose
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(static_image_mode=False, model_complexity=1, enable_segmentation=False)


def process_video(input_path, output_path):
    """Processes a video to add motion analysis markers."""
    cap = cv2.VideoCapture(input_path)
    
    # Use H.264 codec with .mp4 container
    if os.name == 'nt':  # Windows
        fourcc = cv2.VideoWriter_fourcc(*'H264')
    else:  # Linux/Mac
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Convert the frame to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb_frame)

        # Draw pose landmarks
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(
                frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2, circle_radius=2)
            )

        out.write(frame)

    cap.release()
    out.release()


@app.route('/process-video', methods=['POST'])
def upload_video():
    """API endpoint to process video and return the output video."""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Get additional parameters
    height = request.form.get('height')
    sport_type = request.form.get('sport_type')

    if not height or not sport_type:
        return jsonify({"error": "Height and sport_type are required"}), 400

    filename = secure_filename(file.filename)
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    # Ensure output file has .mp4 extension
    output_filename = os.path.splitext(filename)[0] + '.mp4'
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], f"processed_{output_filename}")

    file.save(input_path)

    # Process the video
    process_video(input_path, output_path)

    # Generate additional output data
    analysis_array = [2, 5, 6, 1, 9]
    text_output = "lorem ipsum dolar sit"

    return jsonify({
        "analysis_array": analysis_array,
        "text_output": text_output,
        "output_video_url": f"/download/{os.path.basename(output_path)}"
    })


@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Endpoint to download processed video."""
    path = os.path.join(app.config['OUTPUT_FOLDER'], filename)
    if os.path.exists(path):
        # Set the correct MIME type for MP4 videos
        return send_file(
            path,
            mimetype='video/mp4',
            as_attachment=False  # Changed to False to allow in-browser playback
        )
    return jsonify({"error": "File not found"}), 404


#======================================== ADMIN ===================================================

@app.route('/delete-all-videos', methods=['DELETE'])
def delete_all_videos():
    """API endpoint to delete all videos from input and output folders."""
    try:
        # Delete all files in the UPLOAD_FOLDER
        for filename in os.listdir(UPLOAD_FOLDER):
            file_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)

        # Delete all files in the OUTPUT_FOLDER
        for filename in os.listdir(OUTPUT_FOLDER):
            file_path = os.path.join(OUTPUT_FOLDER, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)

        return jsonify({"message": "All videos deleted successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/')
def hello():
    return "Hello, Flask on AWS EC2!"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
