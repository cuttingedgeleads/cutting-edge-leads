import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";

type LeadAddress = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

const toAddressString = ({ address, city, state, zip }: LeadAddress) => {
  const parts = [address, city, state, zip].map((part) => String(part || "").trim()).filter(Boolean);
  return parts.join(", ");
};

const DISCLAIMER_STRIP_PATH = path.join(
  process.cwd(),
  "src",
  "assets",
  "disclaimer-strip.png",
);

const addDisclaimerToImage = async (buffer: Buffer) => {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 640;
  const height = metadata.height ?? 480;

  const stripBuffer = await readFile(DISCLAIMER_STRIP_PATH);
  const resizedStrip = await sharp(stripBuffer)
    .resize({ width, withoutEnlargement: true })
    .png()
    .toBuffer();
  const resizedMeta = await sharp(resizedStrip).metadata();
  const stripHeight = resizedMeta.height ?? Math.round(width * 0.09375);
  const stripY = height - stripHeight;

  return image
    .composite([
      {
        input: resizedStrip,
        top: stripY,
        left: 0,
      },
    ])
    .toBuffer();
};

const fetchImageAsDataUrl = async (url: string, label?: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image request failed with status ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Unexpected content type: ${contentType}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const watermarkedBuffer = await addDisclaimerToImage(buffer);
  const namePart = label ? `;name=${label}` : "";
  return `data:${contentType}${namePart};base64,${watermarkedBuffer.toString("base64")}`;
};

const geocodeAddress = async (addressString: string) => {
  if (!GOOGLE_MAPS_API_KEY) return null;
  const encoded = encodeURIComponent(addressString);
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}` +
    `&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocode request failed with status ${response.status}`);
  }
  const data = (await response.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>;
  };
  if (data.status !== "OK" || !data.results || data.results.length === 0) {
    return null;
  }
  return data.results[0]?.geometry?.location ?? null;
};

const buildLocationPreviewUrl = async (addressString: string) => {
  try {
    const location = await geocodeAddress(addressString);
    if (!location) return null;
    const { lat, lng } = location;
    const zoom = 12;
    const labelStyle = encodeURIComponent("feature:all|element:labels|visibility:off");
    return (
      `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}` +
      `&zoom=${zoom}&size=640x640&maptype=roadmap` +
      `&markers=color:red|size:mid|${lat},${lng}` +
      `&style=${labelStyle}&key=${GOOGLE_MAPS_API_KEY}`
    );
  } catch (error) {
    console.warn("[Lead Images] Failed to build location preview:", error);
    return null;
  }
};

export async function fetchLeadImages(address: LeadAddress) {
  if (!GOOGLE_MAPS_API_KEY) return [];

  const addressString = toAddressString(address);
  if (!addressString) return [];

  const encoded = encodeURIComponent(addressString);

  const locationPreviewUrl = await buildLocationPreviewUrl(addressString);

  const aerialSize = 560;
  const aerialUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${encoded}` +
    `&zoom=21&size=${aerialSize}x${aerialSize}&maptype=satellite&key=${GOOGLE_MAPS_API_KEY}`;

  const streetUrl =
    `https://maps.googleapis.com/maps/api/streetview?location=${encoded}` +
    `&size=640x480&key=${GOOGLE_MAPS_API_KEY}&return_error_code=true`;

  const requests = [
    { label: "street", url: streetUrl },
    { label: "aerial", url: aerialUrl },
    { label: "map", url: locationPreviewUrl },
  ].filter((request): request is { label: string; url: string } => Boolean(request.url));

  const results = await Promise.allSettled(
    requests.map((request) => fetchImageAsDataUrl(request.url, request.label))
  );

  const images: string[] = [];
  results.forEach((result, index) => {
    const label = requests[index]?.label || "image";
    if (result.status === "fulfilled") {
      images.push(result.value);
    } else {
      console.warn(`[Lead Images] Failed to fetch ${label} view:`, result.reason);
    }
  });

  return images;
}
