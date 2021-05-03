import {
	MeshStandardMaterial,
	DoubleSide, Color, Vector3
} from '../../../build/three.module.js';

import { Shader } from './Shader.js';


export class Diamond extends MeshStandardMaterial {

	constructor( o = {}, extra = {} ) {

		o.metalness = 1;
		o.roughness = 0;
		o.opacity = 0.9;
		o.side = DoubleSide;
		//o.transparent = true;
		o.envMapIntensity = 1;
		//o.premultipliedAlpha = true;
		o.opacity = 1.0;

		super( o );

		this.onBeforeCompile = function ( shader ) {

			var uniforms = shader.uniforms;
			uniforms[ "normalCube" ] = { value: extra.normalCube };
			uniforms[ "bDebugBounces" ] = { value: 0 };

			uniforms[ "mFresnelBias" ] = { value: 0.02 };
			uniforms[ "mFresnelScale" ] = { value: 0.1 };
			uniforms[ "mFresnelPower" ] = { value: 1 };

			uniforms[ "aberration" ] = { value: 0.012 };
			uniforms[ "refraction" ] = { value: 2.417 };

			uniforms[ "normalOffset" ] = { value: 0.0 };
			uniforms[ "squashFactor" ] = { value: 0.98 };
			uniforms[ "distanceOffset" ] = { value: 0 };
			uniforms[ "geometryFactor" ] = { value: 0.28 };

			uniforms[ "absorbption" ] = { value: new Color(0,0,0) };
			uniforms[ "correction" ] = { value: new Color(o.color || 0xFFFFFF ) };
			uniforms[ "boost" ] = { value: new Color(.892, .892, .98595025) };

			uniforms[ "radius" ] = { value: 1.5 };
			uniforms[ "centreOffset" ] = { value: new Vector3(0, 0, 0) };

			shader.uniforms = uniforms;

			//shader.uniforms.reflectif = this.userData.reflectif;

			var vertex = shader.vertexShader;
			vertex = vertex.replace( 'varying vec3 vViewPosition;', vertAdd );
			vertex = vertex.replace( '#include <fog_vertex>', vertMainAdd );
			shader.vertexShader = vertex;

			//console.log(vertex)

			var fragment = shader.fragmentShader;
			fragment = fragment.replace( 'void main() {', fragAdd );
			fragment = fragment.replace( 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );', fragMainAdd );

			shader.fragmentShader = fragment;

			Shader.modify( shader );

		}

	}

}

const vertAdd =/* glsl */`
varying vec3 vViewPosition;

varying mat4 invMat;
varying mat4 modelMatrixOn;

varying vec3 worldNormal;
varying vec3 vecPos;
//varying vec3 vEye;
varying vec3 vI;
`;

const vertMainAdd =/* glsl */`
#include <fog_vertex>

modelMatrixOn = modelMatrix;
invMat = inverse( modelMatrix );
vecPos = worldPosition.xyz;//(modelMatrix * vec4(position, 1.0 )).xyz;
//worldNormal = (modelMatrix * vec4(normal,0.0)).xyz;
worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
//vEye = normalize(-cameraPosition);
vI = normalize( worldPosition.xyz - cameraPosition );//vecPos - cameraPosition;

`;

const fragMainAdd =/* glsl */`
//gl_FragColor = vec4( outgoingLight, diffuseColor.a );


float vReflectionFactor = mFresnelBias + mFresnelScale * pow( abs((1.0 + dot( normalize( vI ), vNormal ))), mFresnelPower );

vec3 refractedColor = traceRayTest( vecPos, vI, normalize( worldNormal ) );

vec3 finalColor = mix( refractedColor, refractedColor*outgoingLight, clamp( vReflectionFactor, 0.0, 1.0 ) );
//vec3 finalColor = refractedColor * outgoingLight;
gl_FragColor = vec4( finalColor, diffuseColor.a);
//reflectedColor.rgb = textureCube( envMap, vec3( -vReflect.x, vReflect.yz ) ).rgb;

`;

const fragAdd =/* glsl */`

#define RAY_BOUNCES 5

varying mat4 invMat;
varying mat4 modelMatrixOn;
varying vec3 worldNormal;
varying vec3 vecPos;
//varying vec3 vEye;
varying vec3 vI;

uniform samplerCube normalCube;
uniform bool bDebugBounces;

uniform float mFresnelBias;
uniform float mFresnelScale;
uniform float mFresnelPower;

uniform float refraction;
uniform float aberration;

uniform float normalOffset;
uniform float squashFactor;
uniform float distanceOffset;
uniform float geometryFactor;

uniform vec3 absorbption;
uniform vec3 correction;
uniform vec3 boost;

uniform float radius;
uniform vec3 centreOffset;

vec3 BRDF_Specular_GGX_EnvironmentTest( const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float roughness ) {
    float dotNV = abs( dot( normal, viewDir ) );
    const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
    const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
    vec4 r = roughness * c0 + c1; 
    float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
    vec2 AB = vec2( -1.04, 1.04 ) * a004 + r.zw;
    return specularColor * AB.x + AB.y;
}

vec4 SampleSpecularReflectionTest( vec4 specularColor, vec3 direction ) {
    direction.x *= -1.0;
    direction.z *= -1.0;
    //vec4 sampleColorRGB = envMapIntensity * envMapTexelToLinear(textureCubeUV( envMap, direction, 0.0 ));
    vec4 sampleColorRGB = envMapIntensity * textureCubeUV( envMap, direction, 0.0 );
    //sampleColorRGB = 1.0 * envMapTexelToLinear( sampleColorRGB );
   // sampleColorRGB = vec4(1.0);
   // if(sampleColorRGB.r + sampleColorRGB.g + sampleColorRGB.b < 0.5 ) sampleColorRGB = vec4(1.0);
    sampleColorRGB = clamp( sampleColorRGB, 0.0, 1.0);
    return sampleColorRGB;
}

vec4 SampleSpecularContributionTest( vec4 specularColor, vec3 direction ) { 
    direction = normalize(direction);
    direction.x *= -1.0; 
    direction.z *= -1.0;
    //vec4 sampleColorRGB = envMapIntensity * envMapTexelToLinear( textureCubeUV( envMap, direction, 0.0 ));
    vec4 sampleColorRGB = envMapIntensity * textureCubeUV( envMap, direction, 0.0 );

    //sampleColorRGB.a = 1.0;

    sampleColorRGB = clamp( sampleColorRGB, 0.0, 1.0);
    return sampleColorRGB;
}

vec3 intersectSphereTest( vec3 origin, vec3 direction ) {
    origin -= centreOffset;
    direction.y /= squashFactor;
    float A = dot(direction, direction);
    float B = 2.0*dot(origin, direction);
    float C = dot(origin, origin) - radius * radius;
    float disc = B*B - 4.0 * A * C;
    if(disc > 0.0){ 
        disc = sqrt(disc);
        float t1 = (-B + disc)*geometryFactor/A;
        float t2 = (-B - disc)*geometryFactor/A;
        float t = (t1 > t2) ? t1 : t2;
        direction.y *= squashFactor;
        return vec3(origin + centreOffset + direction * t);
     }
     return vec3(0.0); 
}

vec3 debugBounces( int count ) { 
    vec3 color = vec3(1.,1.,1.);
    if(count == 1) color = vec3(0.0,1.0,0.0);
    else if(count == 2) color = vec3(0.0,0.0,1.0);
    else if(count == 3) color = vec3(1.0,1.0,0.0);
    else if(count == 4) color = vec3(0.0,1.0,1.0);
    else color = vec3(0.0,1.0,0.0); 
    if(count == 0) color = vec3(1.0,0.0,0.0);
    return color;
}

vec3 traceRayTest( vec3 origin, vec3 direction, vec3 normal ) { 

    mat4 invModelMat = invMat;

    vec3 outColor = vec3(0.0); 
    // Reflect/Refract ray entering the diamond 
    const float n1 = 1.0; 
    const float epsilon = 1e-6;
    float f0 = (2.4- n1)/(2.4 + n1);
    f0 *= f0;
    vec3 attenuationFactor = vec3(1.0);
    vec3 newDirection = refract( direction, normal, n1/refraction ); 
    vec3 reflectedDirection = reflect(direction, normal);
    vec3 brdfReflected = BRDF_Specular_GGX_EnvironmentTest(reflectedDirection, normal, vec3(f0), 0.0);
    vec3 brdfRefracted = BRDF_Specular_GGX_EnvironmentTest(newDirection, -normal, vec3(f0), 0.0);
    attenuationFactor *= ( vec3(1.0) - brdfRefracted);
    outColor += SampleSpecularReflectionTest(vec4(1.0), reflectedDirection ).rgb * brdfReflected;
    int count = 0;
    //newDirection = (invModelMatrix * vec4(newDirection, 0.0)).xyz;
    newDirection = (invModelMat * vec4(newDirection, 0.0)).xyz; 
    newDirection = normalize(newDirection);
    //origin = (invModelMatrix * vec4(origin, 1.0)).xyz; 
    origin = (invModelMat * vec4(origin, 1.0)).xyz;

    // ray bounces 
    for( int i=0; i<RAY_BOUNCES; i++) { 

        vec3 intersectedPos = intersectSphereTest(origin + vec3(epsilon), newDirection);
        vec3 dist = intersectedPos - origin;
        vec3 d = normalize(intersectedPos - centreOffset);
        vec3 mappedNormal = textureCube( normalCube, d ).xyz;
        mappedNormal = 2. * mappedNormal - 1.0;
        mappedNormal.y += normalOffset;
        mappedNormal = normalize(mappedNormal);
        dist = (modelMatrixOn * vec4(dist, 1.)).xyz;
        float r = sqrt(dot(dist, dist));
        attenuationFactor *= exp(-r*absorbption);
        // refract the ray at first intersection 
        vec3 oldOrigin = origin;
        origin = intersectedPos - normalize(intersectedPos - centreOffset) * distanceOffset;
        vec3 oldDir = newDirection;
        newDirection = refract(newDirection, mappedNormal, refraction/n1);
         
        if( dot(newDirection, newDirection) == 0.0) { // Total Internal Reflection. Continue inside the diamond
            newDirection = reflect(oldDir, mappedNormal);
             //If the ray got trapped even after max iterations, simply sample along the outgoing refraction!
            if( i == RAY_BOUNCES-1 ) {
                vec3 brdfReflected = BRDF_Specular_GGX_EnvironmentTest(-oldDir, mappedNormal, vec3(f0), 0.0);
                vec3 d1 = (modelMatrixOn * vec4(oldDir, 0.0)).xyz;
                outColor += SampleSpecularContributionTest( vec4(1.0), d1 ).rgb * correction * attenuationFactor  * boost * (vec3(1.0) - brdfReflected);
                //outColor = vec3(1.,0.,0.);
                //if(d1.y > 0.95) outColor += d1.y * vec3(1.,0.,0) * attenuationFactor * (vec3(1.0) - brdfReflected) * boost;
            } 
        
        } else { // Add the contribution from outgoing ray, and continue the reflected ray inside the diamond 
           vec3 brdfRefracted = BRDF_Specular_GGX_EnvironmentTest(newDirection, -mappedNormal, vec3(f0), 0.0);
           // outgoing(refracted) ray's contribution
           vec3 d1 = (modelMatrixOn * vec4(newDirection, 0.0)).xyz;
           vec3 colorG = SampleSpecularContributionTest(vec4(1.0), d1 ).rgb * ( vec3(1.0) - brdfRefracted);
           vec3 dir1 = refract(oldDir, mappedNormal, (refraction+aberration)/n1);
           vec3 dir2 = refract(oldDir, mappedNormal, (refraction-aberration)/n1);
           vec3 d2 = (modelMatrixOn * vec4(dir1, 0.0)).xyz;
           vec3 d3 = (modelMatrixOn * vec4(dir2, 0.0)).xyz;
           vec3 colorR = SampleSpecularContributionTest(vec4(1.0), d2 ).rgb * ( vec3(1.0) - brdfRefracted);
           vec3 colorB = SampleSpecularContributionTest(vec4(1.0), d3 ).rgb * ( vec3(1.0) - brdfRefracted);
           outColor += vec3(colorR.r, colorG.g, colorB.b) * correction * attenuationFactor * boost;
           //outColor = oldDir;
           //new reflected ray inside the diamond
           newDirection = reflect(oldDir, mappedNormal);
           vec3 brdfReflected = BRDF_Specular_GGX_EnvironmentTest(newDirection, mappedNormal, vec3(f0), 0.0);
           attenuationFactor *= brdfReflected * boost;
           count++;
        } 
    }
    if(bDebugBounces) outColor = debugBounces(count); 
    //outColor = (textureCube( tCubeMapNormals, direction )).rgb;
    //outColor = texture2D( sphereMap, vUv ).rgb
    return outColor;
    
}

void main() {

`;


