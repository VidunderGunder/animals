const resolutions = [
	[1920, 1080],
	[960, 540],
	[640, 360],
	[480, 270],
	[384, 216],
	[320, 180],
	[240, 135],
];

for (const [width, height] of resolutions) {
	console.log(
		`// 16:9 ${width}x${height}, 4:3 ${(width * 3) / 4}x${height}, 5:4 ${(width * 4) / 5}x${height}, 3:2 ${(width * 2) / 3}x${height}`,
	);
}
