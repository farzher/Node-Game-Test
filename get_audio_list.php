<?php
$audio_list = scandir('audio', 1);
echo json_encode($audio_list);
