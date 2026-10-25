/**
 * @license
 * MIT License
 * Copyright (c) 2018 Morgan Villedieu
 * Copyright (c) 2023 Rysana, Inc. (forked from the above)
 * Copyright (c) 2026 LiveKit, Inc. (forked from the above)
 */

import React, { useEffect, useRef } from 'react';

const PRECISIONS = ['lowp', 'mediump', 'highp'];
const FS_MAIN_SHADER = `\nvoid main(void){\n    vec4 color = vec4(0.0,0.0,0.0,1.0);\n    mainImage( color, gl_FragCoord.xy );\n    gl_FragColor = color;\n}`;
const BASIC_FS = `void mainImage( out vec4 fragColor, in vec2 fragCoord ) {\n    vec2 uv = fragCoord/iResolution.xy;\n    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));\n    fragColor = vec4(col,1.0);\n}`;
const BASIC_VS = `attribute vec3 aVertexPosition;\nvoid main(void) {\n    gl_Position = vec4(aVertexPosition, 1.0);\n}`;
const UNIFORM_TIME = 'iTime';
const UNIFORM_TIMEDELTA = 'iTimeDelta';
const UNIFORM_DATE = 'iDate';
const UNIFORM_FRAME = 'iFrame';
const UNIFORM_MOUSE = 'iMouse';
const UNIFORM_RESOLUTION = 'iResolution';

function isMatrixType(t, v) {
  return t.includes('Matrix') && Array.isArray(v);
}
function isVectorListType(t, v) {
  return t.includes('v') && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}
function isVectorType(t, v) {
  return !t.includes('v') && Array.isArray(v) && v.length > Number.parseInt(t.charAt(0));
}

const processUniform = (gl, location, t, value) => {
  if (isVectorType(t, value)) {
    switch (t) {
      case '2f':
        return gl.uniform2f(location, value[0], value[1]);
      case '3f':
        return gl.uniform3f(location, value[0], value[1], value[2]);
      case '4f':
        return gl.uniform4f(location, value[0], value[1], value[2], value[3]);
      case '2i':
        return gl.uniform2i(location, value[0], value[1]);
      case '3i':
        return gl.uniform3i(location, value[0], value[1], value[2]);
      case '4i':
        return gl.uniform4i(location, value[0], value[1], value[2], value[3]);
      default:
        break;
    }
  }
  if (typeof value === 'number') {
    switch (t) {
      case '1i':
        return gl.uniform1i(location, value);
      default:
        return gl.uniform1f(location, value);
    }
  }
  switch (t) {
    case '1iv':
      return gl.uniform1iv(location, value);
    case '2iv':
      return gl.uniform2iv(location, value);
    case '3iv':
      return gl.uniform3iv(location, value);
    case '4iv':
      return gl.uniform4iv(location, value);
    case '1fv':
      return gl.uniform1fv(location, value);
    case '2fv':
      return gl.uniform2fv(location, value);
    case '3fv':
      return gl.uniform3fv(location, value);
    case '4fv':
      return gl.uniform4fv(location, value);
    case 'Matrix2fv':
      return gl.uniformMatrix2fv(location, false, value);
    case 'Matrix3fv':
      return gl.uniformMatrix3fv(location, false, value);
    case 'Matrix4fv':
      return gl.uniformMatrix4fv(location, false, value);
    default:
      break;
  }
};

const uniformTypeToGLSLType = (t) => {
  switch (t) {
    case '1f':
      return 'float';
    case '2f':
      return 'vec2';
    case '3f':
      return 'vec3';
    case '4f':
      return 'vec4';
    case '1i':
      return 'int';
    case '2i':
      return 'ivec2';
    case '3i':
      return 'ivec3';
    case '4i':
      return 'ivec4';
    case '1iv':
      return 'int';
    case '2iv':
      return 'ivec2';
    case '3iv':
      return 'ivec3';
    case '4iv':
      return 'ivec4';
    case '1fv':
      return 'float';
    case '2fv':
      return 'vec2';
    case '3fv':
      return 'vec3';
    case '4fv':
      return 'vec4';
    case 'Matrix2fv':
      return 'mat2';
    case 'Matrix3fv':
      return 'mat3';
    case 'Matrix4fv':
      return 'mat4';
    default:
      return 'float';
  }
};

const log = (text) => `react-shaders: ${text}`;

const latestPointerClientCoords = (e) => {
  if ('changedTouches' in e && e.changedTouches?.length > 0) {
    const t = e.changedTouches[0];
    return [t?.clientX ?? 0, t?.clientY ?? 0];
  }
  return [e.clientX || 0, e.clientY || 0];
};

const lerpVal = (v0, v1, t) => v0 * (1 - t) + v1 * t;

const insertStringAtIndex = (currentString, string, index) =>
  index > 0
    ? currentString.substring(0, index) +
      string +
      currentString.substring(index, currentString.length)
    : string + currentString;

export function ReactShaderToy({
  fs,
  vs = BASIC_VS,
  textures = [],
  uniforms: propUniforms,
  clearColor = [0, 0, 0, 1],
  precision = 'highp',
  style,
  contextAttributes = {},
  lerp = 1,
  devicePixelRatio = 1,
  onDoneLoadingTextures,
  onError = console.error,
  onWarning = console.warn,
  animateWhenNotVisible = false,
  ...canvasProps
}) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const squareVerticesBufferRef = useRef(null);
  const shaderProgramRef = useRef(null);
  const vertexPositionAttributeRef = useRef(undefined);
  const animFrameIdRef = useRef(undefined);
  const initFrameIdRef = useRef(undefined);
  const isVisibleRef = useRef(true);
  const animateWhenNotVisibleRef = useRef(animateWhenNotVisible);
  const mousedownRef = useRef(false);
  const canvasPositionRef = useRef(undefined);
  const timerRef = useRef(0);
  const lastMouseArrRef = useRef([0, 0]);
  const lastTimeRef = useRef(0);
  const resizeObserverRef = useRef(undefined);

  const uniformsRef = useRef({
    [UNIFORM_TIME]: { type: 'float', isNeeded: false, value: 0 },
    [UNIFORM_TIMEDELTA]: { type: 'float', isNeeded: false, value: 0 },
    [UNIFORM_DATE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
    [UNIFORM_MOUSE]: { type: 'vec4', isNeeded: false, value: [0, 0, 0, 0] },
    [UNIFORM_RESOLUTION]: { type: 'vec2', isNeeded: false, value: [0, 0] },
    [UNIFORM_FRAME]: { type: 'int', isNeeded: false, value: 0 },
  });

  const propsUniformsRef = useRef(propUniforms);

  const initWebGL = () => {
    if (!canvasRef.current) return;
    try {
      glRef.current =
        canvasRef.current.getContext('webgl', contextAttributes) ||
        canvasRef.current.getContext('experimental-webgl', contextAttributes);
      glRef.current?.getExtension('OES_standard_derivatives');
      glRef.current?.getExtension('EXT_shader_texture_lod');
    } catch (e) {
      console.warn('WebGL init note:', e);
    }
  };

  const initBuffers = () => {
    const gl = glRef.current;
    if (!gl) return;
    squareVerticesBufferRef.current = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBufferRef.current);
    const vertices = [1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  };

  const mouseDown = (e) => {
    const [clientX = 0, clientY = 0] = latestPointerClientCoords(e);
    const mouseX = clientX - (canvasPositionRef.current?.left ?? 0) - window.pageXOffset;
    const mouseY =
      (canvasPositionRef.current?.height ?? 0) -
      clientY -
      (canvasPositionRef.current?.top ?? 0) -
      window.pageYOffset;
    mousedownRef.current = true;
    const mouseValue = Array.isArray(uniformsRef.current.iMouse?.value)
      ? uniformsRef.current.iMouse.value
      : undefined;
    if (mouseValue) {
      mouseValue[2] = mouseX;
      mouseValue[3] = mouseY;
    }
    lastMouseArrRef.current[0] = mouseX;
    lastMouseArrRef.current[1] = mouseY;
  };

  const mouseMove = (e) => {
    canvasPositionRef.current = canvasRef.current?.getBoundingClientRect();
    const [clientX = 0, clientY = 0] = latestPointerClientCoords(e);
    const mouseX = clientX - (canvasPositionRef.current?.left ?? 0);
    const mouseY =
      (canvasPositionRef.current?.height ?? 0) - clientY - (canvasPositionRef.current?.top ?? 0);
    if (lerp !== 1) {
      lastMouseArrRef.current[0] = mouseX;
      lastMouseArrRef.current[1] = mouseY;
    } else {
      const mouseValue = Array.isArray(uniformsRef.current.iMouse?.value)
        ? uniformsRef.current.iMouse.value
        : undefined;
      if (mouseValue) {
        mouseValue[0] = mouseX;
        mouseValue[1] = mouseY;
      }
    }
  };

  const mouseUp = () => {
    const mouseValue = Array.isArray(uniformsRef.current.iMouse?.value)
      ? uniformsRef.current.iMouse.value
      : undefined;
    if (mouseValue) {
      mouseValue[2] = 0;
      mouseValue[3] = 0;
    }
  };

  const onResize = () => {
    const gl = glRef.current;
    if (!gl || !canvasRef.current) return;
    canvasPositionRef.current = canvasRef.current.getBoundingClientRect();
    const realToCSSPixels = devicePixelRatio || 1;
    const displayWidth = Math.max(1, Math.floor((canvasPositionRef.current?.width || canvasRef.current.clientWidth || 300) * realToCSSPixels));
    const displayHeight = Math.max(1, Math.floor((canvasPositionRef.current?.height || canvasRef.current.clientHeight || 300) * realToCSSPixels));
    gl.canvas.width = displayWidth;
    gl.canvas.height = displayHeight;
    if (uniformsRef.current.iResolution?.isNeeded && shaderProgramRef.current) {
      const rUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_RESOLUTION);
      if (rUniform) {
        gl.uniform2fv(rUniform, [gl.canvas.width, gl.canvas.height]);
      }
    }
  };

  const createShader = (type, shaderCodeAsText) => {
    const gl = glRef.current;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, shaderCodeAsText);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      onWarning?.(log(`Error compiling shader`));
      const compilationLog = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      onError?.(log(`Shader compiler log: ${compilationLog}`));
      return null;
    }
    return shader;
  };

  const initShaders = (fragmentShader, vertexShader) => {
    const gl = glRef.current;
    if (!gl) return;
    const fragmentShaderObj = createShader(gl.FRAGMENT_SHADER, fragmentShader);
    const vertexShaderObj = createShader(gl.VERTEX_SHADER, vertexShader);
    if (!vertexShaderObj || !fragmentShaderObj) return;

    shaderProgramRef.current = gl.createProgram();
    if (!shaderProgramRef.current) return;

    gl.attachShader(shaderProgramRef.current, vertexShaderObj);
    gl.attachShader(shaderProgramRef.current, fragmentShaderObj);
    gl.linkProgram(shaderProgramRef.current);

    if (!gl.getProgramParameter(shaderProgramRef.current, gl.LINK_STATUS)) {
      onError?.(log(`Unable to initialize shader program: ${gl.getProgramInfoLog(shaderProgramRef.current)}`));
      return;
    }
    gl.useProgram(shaderProgramRef.current);
    vertexPositionAttributeRef.current = gl.getAttribLocation(
      shaderProgramRef.current,
      'aVertexPosition',
    );
    if (vertexPositionAttributeRef.current !== -1) {
      gl.enableVertexAttribArray(vertexPositionAttributeRef.current);
    }
  };

  const processCustomUniforms = () => {
    if (propUniforms) {
      for (const name of Object.keys(propUniforms)) {
        const uniform = propUniforms[name];
        if (!uniform) continue;
        const { value, type } = uniform;
        const glslType = uniformTypeToGLSLType(type);
        if (!glslType) continue;
        const tempObject = {};
        if (isMatrixType(type, value)) {
          const arrayLength = type.length;
          const val = Number.parseInt(type.charAt(arrayLength - 3));
          const numberOfMatrices = Math.floor(value.length / (val * val));
          if (value.length > val * val) tempObject.arraySize = `[${numberOfMatrices}]`;
        } else if (isVectorListType(type, value)) {
          tempObject.arraySize = `[${Math.floor(value.length / Number.parseInt(type.charAt(0)))}]`;
        }
        uniformsRef.current[name] = { type: glslType, isNeeded: false, value, ...tempObject };
      }
    }
  };

  const preProcessFragment = (fragment) => {
    const isValidPrecision = PRECISIONS.includes(precision ?? 'highp');
    const precisionString = `precision ${isValidPrecision ? precision : PRECISIONS[1]} float;\n`;
    let fragmentShader = precisionString
      .concat(`#define DPR ${(devicePixelRatio || 1).toFixed(1)}\n`)
      .concat(fragment.replace(/texture\(/g, 'texture2D('));
    for (const uniform of Object.keys(uniformsRef.current)) {
      if (fragment.includes(uniform)) {
        const u = uniformsRef.current[uniform];
        if (!u) continue;
        fragmentShader = insertStringAtIndex(
          fragmentShader,
          `uniform ${u.type} ${uniform}${u.arraySize || ''}; \n`,
          fragmentShader.lastIndexOf(precisionString) + precisionString.length,
        );
        u.isNeeded = true;
      }
    }
    const isShadertoy = fragment.includes('mainImage');
    if (isShadertoy) fragmentShader = fragmentShader.concat(FS_MAIN_SHADER);
    return fragmentShader;
  };

  const setUniforms = (timestamp) => {
    const gl = glRef.current;
    if (!gl || !shaderProgramRef.current) return;
    const delta = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = timestamp;
    const propUniforms = propsUniformsRef.current;

    if (propUniforms) {
      for (const name of Object.keys(propUniforms)) {
        const currentUniform = propUniforms[name];
        if (!currentUniform) continue;
        if (uniformsRef.current[name]?.isNeeded) {
          const customUniformLocation = gl.getUniformLocation(shaderProgramRef.current, name);
          if (customUniformLocation) {
            processUniform(
              gl,
              customUniformLocation,
              currentUniform.type,
              currentUniform.value,
            );
          }
        }
      }
    }

    if (uniformsRef.current.iTime?.isNeeded) {
      const timeUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_TIME);
      if (timeUniform) {
        gl.uniform1f(timeUniform, (timerRef.current += delta));
      }
    }
    if (uniformsRef.current.iResolution?.isNeeded) {
      const rUniform = gl.getUniformLocation(shaderProgramRef.current, UNIFORM_RESOLUTION);
      if (rUniform) {
        gl.uniform2fv(rUniform, [gl.canvas.width, gl.canvas.height]);
      }
    }
  };

  const drawScene = (timestamp) => {
    const gl = glRef.current;
    if (!gl || !shaderProgramRef.current) return;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, squareVerticesBufferRef.current);
    if (vertexPositionAttributeRef.current !== undefined && vertexPositionAttributeRef.current !== -1) {
      gl.vertexAttribPointer(vertexPositionAttributeRef.current, 3, gl.FLOAT, false, 0, 0);
    }
    setUniforms(timestamp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (animateWhenNotVisibleRef.current || isVisibleRef.current) {
      animFrameIdRef.current = requestAnimationFrame(drawScene);
    }
  };

  const addEventListeners = () => {
    const options = { passive: true };
    if (canvasRef.current) {
      resizeObserverRef.current = new ResizeObserver(onResize);
      resizeObserverRef.current.observe(canvasRef.current);
      window.addEventListener('resize', onResize, options);
    }
  };

  const removeEventListeners = () => {
    const options = { passive: true };
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      window.removeEventListener('resize', onResize, options);
    }
  };

  useEffect(() => {
    propsUniformsRef.current = propUniforms;
  }, [propUniforms]);

  useEffect(() => {
    function init() {
      initWebGL();
      const gl = glRef.current;
      if (gl && canvasRef.current) {
        gl.clearColor(...clearColor);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.viewport(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasRef.current.height = canvasRef.current.clientHeight || 300;
        canvasRef.current.width = canvasRef.current.clientWidth || 300;
        processCustomUniforms();
        initShaders(preProcessFragment(fs || BASIC_FS), vs || BASIC_VS);
        initBuffers();
        requestAnimationFrame(drawScene);
        addEventListeners();
        onResize();
      }
    }

    initFrameIdRef.current = requestAnimationFrame(init);

    return () => {
      const gl = glRef.current;
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        gl.useProgram(null);
        if (shaderProgramRef.current) {
          gl.deleteProgram(shaderProgramRef.current);
          shaderProgramRef.current = null;
        }
      }
      removeEventListeners();
      cancelAnimationFrame(initFrameIdRef.current ?? 0);
      cancelAnimationFrame(animFrameIdRef.current ?? 0);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{ height: '100%', width: '100%', ...style }} {...canvasProps} />
  );
}
