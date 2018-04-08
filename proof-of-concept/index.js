const exec = require("child_process").exec
var Jimp = require("jimp");
 
var setPixel = function(img, value, idx) {
    img.bitmap.data[ idx + 0 ] = value;
    img.bitmap.data[ idx + 1 ] = value;
    img.bitmap.data[ idx + 2 ] = value;
    img.bitmap.data[ idx + 3 ] = 255;
}


var contrast = function(image) {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
        var red   = this.bitmap.data[ idx + 0 ];
        var green = this.bitmap.data[ idx + 1 ];
        var blue  = this.bitmap.data[ idx + 2 ];
        var alpha = this.bitmap.data[ idx + 3 ];
        if (red > blue + 20 && red > green + 20) {
            // absolute zero is our pixel
            setPixel(this, 0, idx)
        } else {
            setPixel(this, 255, idx)
        }
    });
}


var cleanup = function(image) {
    var width = image.bitmap.width;
    var height = image.bitmap.height;

    for (var y = 0; y < height; y++) {
        var sum = 0;
        var blackPixels = 0;

        for (var x = 0; x < width; x++) {
            var pixel = Jimp.intToRGBA(image.getPixelColor(x,y))
            if (pixel.r == 0 && pixel.g == 0 && pixel.b == 0) {
                sum += x;
                blackPixels++;
            }
        }
        var centerBlackPosition = Math.round(sum / blackPixels);
        for (var i = centerBlackPosition - 10; i < centerBlackPosition + 10; i++) {
            if (i < 0) continue;
            if (i > width) continue;
            image.setPixelColor(Jimp.rgbaToInt(255,0,0,255), i, y)
        }
    }
}

Jimp.read(process.argv[2] || "../data/picture-from-iphone-45-degree.png", function (err, image) {
    if (err) throw err;
    var originalWidth = image.bitmap.width
    image.resize(Jimp.AUTO, 512)

    contrast(image)
    cleanup(image)

    image.resize(Jimp.AUTO, originalWidth)
    image.write("processed.png")

    exec('open processed.png').unref()
});
