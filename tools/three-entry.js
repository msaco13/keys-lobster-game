// The parts of three.js the game uses. tools/vendor-three.mjs bundles this into js/vendor/three.min.js as window.THREE,
// so the game still plays from index.html with no build step. Add a name here (and re-run the script) to use more of three.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Object3D, Mesh, InstancedMesh, Sprite, Points, LineSegments,
  BufferGeometry, BufferAttribute, InstancedBufferAttribute, Float32BufferAttribute,
  PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, SphereGeometry, IcosahedronGeometry,
  ShaderMaterial, MeshLambertMaterial, MeshBasicMaterial, SpriteMaterial, LineBasicMaterial,
  DataTexture, CanvasTexture, Texture,
  DirectionalLight, HemisphereLight, AmbientLight, Fog,
  Color, Vector2, Vector3, Vector4, Matrix3, Matrix4, Quaternion, Euler,
  ColorManagement, LinearSRGBColorSpace, NoToneMapping,
  RepeatWrapping, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, NearestFilter, RGBAFormat, RedFormat, UnsignedByteType,
  DoubleSide, FrontSide, BackSide, AdditiveBlending, NormalBlending, MultiplyBlending, DynamicDrawUsage, REVISION
} from 'three';
