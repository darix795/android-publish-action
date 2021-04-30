const { ReadStream, createReadStream } = require("fs");
const { google } = require("googleapis");
const core = require("@actions/core");
const github = require("@actions/github");

const getClient = (keyFile, credentials) =>
  google.auth.getClient({
    keyFile,
    credentials,
    scopes: "https://www.googleapis.com/auth/androidpublisher",
  });

const getAndroidPublisher = (client, packageName) =>
  google.androidpublisher({
    version: "v3",
    auth: client,
    params: {
      packageName,
    },
  });

const startEdit = (androidPublisher, id) =>
  androidPublisher.edits.insert({
    requestBody: {
      id,
      expiryTimeSeconds: "600",
    },
  });

const upload = (androidPublisher, editId, packageName, aab) =>
  androidPublisher.edits.bundles.upload({
    editId,
    packageName,
    media: {
      mimeType: "application/octet-stream",
      body: aab,
    },
  });

const setTrack = (androidPublisher, editId, packageName, track, versionCode) =>
  androidPublisher.edits.tracks.update({
    editId,
    track: track,
    packageName,
    requestBody: {
      track: track,
      releases: [
        {
          status: "draft",
          versionCodes: [versionCode],
        },
      ],
    },
  });

const commit = (androidPublisher, editId, packageName) =>
  androidPublisher.edits.commit({
    editId,
    packageName,
  });

const getAABStream = (filePath) => createReadStream(filePath);
const getId = () => String(new Date().getTime());

const publish = async ({
  keyFile,
  credentials,
  packageName,
  aabFile,
  track,
}) => {
  const client = await getClient(keyFile, credentials);
  const stream = getAABStream(aabFile);
  const androidPublisher = getAndroidPublisher(client, packageName);
  const id = getId();
  const edit = await startEdit(androidPublisher, id);
  const editId = String(edit.data.id);
  const bundle = await upload(androidPublisher, editId, packageName, stream);
  if (
    bundle.data.versionCode === undefined ||
    bundle.data.versionCode === null
  ) {
    throw new Error("Bundle versionCode cannot be undefined or null");
  }
  await setTrack(
    androidPublisher,
    editId,
    packageName,
    track,
    String(bundle.data.versionCode)
  );
  await commit(androidPublisher, editId, packageName);
};

(async () => {
  try {
    core.info("Publish to Google Play");

    const keyFile = core.getInput("key-file");
    const aabFile = core.getInput("aab-file");
    const packageName = core.getInput("package-name");

    await publish({
      keyFile,
      aabFile,
      packageName,
      track: "internal",
      credentials: undefined,
    });
  } catch (error) {
    core.setFailed(error.message);
  }
})();
