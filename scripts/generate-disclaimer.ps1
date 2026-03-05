Add-Type -AssemblyName System.Drawing

$path = "C:\Users\User\.openclaw\workspace\cutting-edge-leads\src\assets\disclaimer-strip.png"
$text = "Image from Google. May not be accurate."

$width = 1280
$height = 70

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$bitmap.SetResolution(300, 300)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$bg = [System.Drawing.Color]::FromArgb(255, 255, 0, 0)
$graphics.Clear($bg)

$fontName = "Arial Black"
$fontSize = 30
$fontStyle = [System.Drawing.FontStyle]::Bold
$font = New-Object System.Drawing.Font($fontName, $fontSize, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)

# Adjust font size to fit within width/height if needed
$maxWidth = $width - 40
$maxHeight = $height - 20
while ($true) {
  $size = $graphics.MeasureString($text, $font)
  if (($size.Width -le $maxWidth -and $size.Height -le $maxHeight) -or $fontSize -le 18) { break }
  $font.Dispose()
  $fontSize -= 2
  $font = New-Object System.Drawing.Font($fontName, $fontSize, $fontStyle, [System.Drawing.GraphicsUnit]::Pixel)
}

$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)

$x = ($width - $size.Width) / 2
$y = ($height - $size.Height) / 2

$graphics.DrawString($text, $font, $brush, $x, $y)

$bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

$brush.Dispose()
$font.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Generated $path ($width x $height, font size $fontSize)"
