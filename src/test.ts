import ffmpeg from 'fluent-ffmpeg'

ffmpeg()
  .input('.tmp/sticker.jpg')
  .outputOptions(['-y'])
  .videoFilter("[0]scale=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):force_original_aspect_ratio=decrease[scaled];[scaled]pad=2*trunc(max(iw\\,ih)/2):2*trunc(max(iw\\,ih)/2):(ow-iw)/2:(oh-ih)/2:color=0x00000000")
  .outputOptions(['-pix_fmt bgra', '-lossless 1'])
  .output('.tmp/sticker.webp').run()