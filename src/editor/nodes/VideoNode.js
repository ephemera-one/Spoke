import EditorNodeMixin from "./EditorNodeMixin";
import Video from "../objects/Video";
import Hls from "hls.js/dist/hls.light";
import isHLS from "../utils/isHLS";
import spokeLandingVideo from "../../assets/video/SpokePromo.mp4";
import { RethrownError } from "../utils/errors";
import { getObjectPerfIssues } from "../utils/performance";
import { AudioType, DistanceModelType } from "../objects/AudioParams";

export default class VideoNode extends EditorNodeMixin(Video) {
  static componentName = "video";

  static nodeName = "Video";

  static initialElementProps = {
    src: new URL(spokeLandingVideo, location).href
  };

  static async deserialize(editor, json, loadAsync, onError) {
    const node = await super.deserialize(editor, json);

    const videoComp = json.components.find(c => c.name === "video");
    const { src, controls, autoPlay, loop, projection } = videoComp.props;
    const audioParamsComp = json.components.find(c => c.name === "audio-params");
    const {
      audioType,
      gain,
      distanceModel,
      rolloffFactor,
      refDistance,
      maxDistance,
      coneInnerAngle,
      coneOuterAngle,
      coneOuterGain
    } = audioParamsComp.props;

    loadAsync(
      (async () => {
        await node.load(src, onError);
        node.controls = controls || false;
        node.autoPlay = autoPlay;
        node.loop = loop;
        node.projection = projection;
        node.audioType = audioType;
        node.gain = gain;
        node.distanceModel = distanceModel;
        node.rolloffFactor = rolloffFactor;
        node.refDistance = refDistance;
        node.maxDistance = maxDistance;
        node.coneInnerAngle = coneInnerAngle;
        node.coneOuterAngle = coneOuterAngle;
        node.coneOuterGain = coneOuterGain;
      })()
    );

    if (json.components.find(c => c.name === "billboard")) {
      node.billboard = true;
    }

    const linkComponent = json.components.find(c => c.name === "link");

    if (linkComponent) {
      node.href = linkComponent.props.href;
    }

    loadAsync(
      (async () => {
        await node.load(src, onError);
        node.controls = controls || false;
        node.autoPlay = autoPlay;
        node.loop = loop;
        node.audioType = audioType;
        node.gain = gain;
        node.distanceModel = distanceModel;
        node.rolloffFactor = rolloffFactor;
        node.refDistance = refDistance;
        node.maxDistance = maxDistance;
        node.coneInnerAngle = coneInnerAngle;
        node.coneOuterAngle = coneOuterAngle;
        node.coneOuterGain = coneOuterGain;
        node.projection = projection;
      })()
    );

    return node;
  }

  constructor(editor) {
    super(editor, editor.audioListener);

    this._canonicalUrl = "";
    this._autoPlay = true;
    this.controls = true;
    this.billboard = false;
    this.href = "";
  }

  get src() {
    return this._canonicalUrl;
  }

  get autoPlay() {
    return this._autoPlay;
  }

  set autoPlay(value) {
    this._autoPlay = value;
  }

  set src(value) {
    this.load(value).catch(console.error);
  }

  async load(src, onError) {
    const nextSrc = src || "";

    if (nextSrc === this._canonicalUrl && nextSrc !== "") {
      return;
    }

    this._canonicalUrl = src || "";

    this.issues = [];
    this._mesh.visible = false;

    this.hideErrorIcon();
    this.showLoadingCube();

    if (this.editor.playing) {
      this.el.pause();
    }

    try {
      const { accessibleUrl, contentType, meta } = await this.editor.api.resolveMedia(src);

      this.meta = meta;

      this.updateAttribution();

      const isHls = isHLS(src, contentType);

      if (isHls) {
        this.hls = new Hls({
          xhrSetup: (xhr, url) => {
            xhr.open("GET", this.editor.api.unproxyUrl(src, url));
          }
        });
      }

      await super.load(accessibleUrl, contentType);

      if (isHls && this.hls) {
        this.hls.stopLoad();
      } else if (this.el.duration) {
        this.el.currentTime = 1;
      }

      if (this.editor.playing && this.autoPlay) {
        this.el.play();
      }

      this.issues = getObjectPerfIssues(this._mesh, false);
    } catch (error) {
      this.showErrorIcon();

      const videoError = new RethrownError(`Error loading video ${this._canonicalUrl}`, error);

      if (onError) {
        onError(this, videoError);
      }

      console.error(videoError);

      this.issues.push({ severity: "error", message: "Error loading video." });
    }

    this.editor.emit("objectsChanged", [this]);
    this.editor.emit("selectionChanged");
    this.hideLoadingCube();

    return this;
  }

  onPlay() {
    if (this.autoPlay) {
      this.el.play();
    }
  }

  onPause() {
    this.el.pause();
    this.el.currentTime = 0;
  }

  onChange() {
    this.onResize();
  }

  clone(recursive) {
    return new this.constructor(this.editor, this.audioListener).copy(this, recursive);
  }

  copy(source, recursive = true) {
    super.copy(source, recursive);

    this.controls = source.controls;
    this.billboard = source.billboard;
    this._canonicalUrl = source._canonicalUrl;
    this.href = source.href;

    return this;
  }

  serialize() {
    const components = {
      video: {
        src: this._canonicalUrl,
        controls: this.controls,
        autoPlay: this.autoPlay,
        loop: this.loop,
        projection: this.projection
      },
      "audio-params": {
        audioType: this.audioType,
        gain: this.gain,
        distanceModel: this.distanceModel,
        rolloffFactor: this.rolloffFactor,
        refDistance: this.refDistance,
        maxDistance: this.maxDistance,
        coneInnerAngle: this.coneInnerAngle,
        coneOuterAngle: this.coneOuterAngle,
        coneOuterGain: this.coneOuterGain
      }
    };

    if (this.billboard) {
      components.billboard = {};
    }

    if (this.href) {
      components.link = { href: this.href };
    }

    return super.serialize(components);
  }

  prepareForExport() {
    super.prepareForExport();

    this.addGLTFComponent("video", {
      src: this._canonicalUrl,
      controls: this.controls,
      autoPlay: this.autoPlay,
      loop: this.loop,
      projection: this.projection
    });

    this.addGLTFComponent("networked", {
      id: this.uuid
    });

    if (this.billboard && this.projection === "flat") {
      this.addGLTFComponent("billboard", {});
    }

    if (this.href && this.projection === "flat") {
      this.addGLTFComponent("link", { href: this.href });
    }

    // We don't want artificial distance based attenuation to be applied to stereo audios
    // so we set the distanceModel and rolloffFactor so the attenuation is always 1.
    this.addGLTFComponent("audio-params", {
      audioType: this.audioType,
      gain: this.gain,
      distanceModel: this.audioType === AudioType.Stereo ? DistanceModelType.Linear : this.distanceModel,
      rolloffFactor: this.audioType === AudioType.Stereo ? 0 : this.rolloffFactor,
      refDistance: this.refDistance,
      maxDistance: this.maxDistance,
      coneInnerAngle: this.coneInnerAngle,
      coneOuterAngle: this.coneOuterAngle,
      coneOuterGain: this.coneOuterGain
    });

    this.replaceObject();
  }

  getRuntimeResourcesForStats() {
    if (this._texture) {
      return { textures: [this._texture], meshes: [this._mesh], materials: [this._mesh.material] };
    }
  }
}
