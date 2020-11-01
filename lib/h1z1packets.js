"use strict";
// ======================================================================
//
//   GNU GENERAL PUBLIC LICENSE
//   Version 3, 29 June 2007
//   copyright (c) 2020 Quentin Gruber
//
//   https://github.com/QuentinGruber/h1z1-server
//   https://www.npmjs.com/package/h1z1-server
//
//   Based on https://github.com/psemu/soe-network
// ======================================================================
var PacketTable = require("./packettable"), DataSchema = require("h1z1-dataschema");
function readPacketType(data, packets) {
    var opCode = data[0] >>> 0, length = 0, packet;
    if (packets[opCode]) {
        packet = packets[opCode];
        length = 1;
    }
    else if (data.length > 1) {
        opCode = ((data[0] << 8) + data[1]) >>> 0;
        if (packets[opCode]) {
            packet = packets[opCode];
            length = 2;
        }
        else if (data.length > 2) {
            opCode = ((data[0] << 16) + (data[1] << 8) + data[2]) >>> 0;
            if (packets[opCode]) {
                packet = packets[opCode];
                length = 3;
            }
            else if (data.length > 3) {
                opCode =
                    ((data[0] << 24) + (data[1] << 16) + (data[2] << 8) + data[3]) >>> 0;
                if (packets[opCode]) {
                    packet = packets[opCode];
                    length = 4;
                }
            }
        }
    }
    return {
        packetType: opCode,
        packet: packet,
        length: length,
    };
}
function writePacketType(packetType) {
    var packetTypeBytes = [];
    while (packetType) {
        packetTypeBytes.unshift(packetType & 0xff);
        packetType = packetType >> 8;
    }
    var data = new Buffer.alloc(packetTypeBytes.length);
    for (var i = 0; i < packetTypeBytes.length; i++) {
        data.writeUInt8(packetTypeBytes[i], i);
    }
    return data;
}
function readUnsignedIntWith2bitLengthValue(data, offset) {
    var value = data.readUInt8(offset);
    var n = value & 3;
    for (var i = 0; i < n; i++) {
        value += data.readUInt8(offset + i + 1) << ((i + 1) * 8);
    }
    value = value >>> 2;
    return {
        value: value,
        length: n + 1,
    };
}
function packUnsignedIntWith2bitLengthValue(value) {
    value = Math.round(value);
    value = value << 2;
    var n = 0;
    if (value > 0xffffff) {
        n = 3;
    }
    else if (value > 0xffff) {
        n = 2;
    }
    else if (value > 0xff) {
        n = 1;
    }
    value |= n;
    var data = new Buffer.alloc(4);
    data.writeUInt32LE(value, 0);
    return data.slice(0, n + 1);
}
function readSignedIntWith2bitLengthValue(data, offset) {
    var value = data.readUInt8(offset);
    var sign = value & 1;
    var n = (value >> 1) & 3;
    for (var i = 0; i < n; i++) {
        value += data.readUInt8(offset + i + 1) << ((i + 1) * 8);
    }
    value = value >>> 3;
    if (sign) {
        value = -value;
    }
    return {
        value: value,
        length: n + 1,
    };
}
function packSignedIntWith2bitLengthValue(value) {
    value = Math.round(value);
    var sign = value < 0 ? 1 : 0;
    value = sign ? -value : value;
    value = value << 3;
    var n = 0;
    if (value > 0xffffff) {
        n = 3;
    }
    else if (value > 0xffff) {
        n = 2;
    }
    else if (value > 0xff) {
        n = 1;
    }
    value |= n << 1;
    value |= sign;
    var data = new Buffer.alloc(4);
    data.writeUInt32LE(value, 0);
    return data.slice(0, n + 1);
}
function readPositionUpdateData(data, offset) {
    var obj = {}, startOffset = offset;
    obj["flags"] = data.readUInt16LE(offset);
    offset += 2;
    obj["unknown2_int32"] = data.readUInt32LE(offset);
    offset += 4;
    obj["unknown3_int8"] = data.readUInt8(offset);
    offset += 1;
    if (obj.flags & 1) {
        var v = readUnsignedIntWith2bitLengthValue(data, offset);
        obj["unknown4"] = v.value;
        offset += v.length;
    }
    if (obj.flags & 2) {
        obj["position"] = [];
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["position"][0] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["position"][1] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["position"][2] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x20) {
        obj["unknown6_int32"] = data.readUInt32LE(offset);
        offset += 4;
    }
    if (obj.flags & 0x40) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown7_float"] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x80) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown8_float"] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 4) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown9_float"] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x8) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown10_float"] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x10) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown11_float"] = v.value / 10;
        offset += v.length;
    }
    if (obj.flags & 0x100) {
        obj["unknown12_float"] = [];
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown12_float"][0] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown12_float"][1] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown12_float"][2] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x200) {
        obj["unknown13_float"] = [];
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown13_float"][0] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown13_float"][1] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown13_float"][2] = v.value / 100;
        offset += v.length;
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown13_float"][3] = v.value / 100;
        offset += v.length;
    }
    if (obj.flags & 0x400) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown14_float"] = v.value / 10;
        offset += v.length;
    }
    if (obj.flags & 0x800) {
        var v = readSignedIntWith2bitLengthValue(data, offset);
        obj["unknown15_float"] = v.value / 10;
        offset += v.length;
    }
    if (obj.flags & 0xe0) {
    }
    return {
        value: obj,
        length: offset - startOffset,
    };
}
function packPositionUpdateData(obj) {
    var data = new Buffer.alloc(7), flags = 0, v;
    data.writeUInt32LE(obj["unknown2_int32"], 2);
    data.writeUInt8(obj["unknown3_int8"], 6);
    if ("unknown4" in obj) {
        flags |= 1;
        v = packUnsignedIntWith2bitLengthValue(obj["unknown4"]);
        data = Buffer.concat([data, v]);
    }
    if ("position" in obj) {
        flags |= 2;
        v = packSignedIntWith2bitLengthValue(obj["position"][0] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["position"][1] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["position"][2] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown6_int32" in obj) {
        flags |= 0x20;
        v = new Buffer.alloc(4);
        v.writeUInt32LE(obj["unknown6_int32"], 0);
        data = Buffer.concat([data, v]);
    }
    if ("unknown7_float" in obj) {
        flags |= 0x40;
        v = packSignedIntWith2bitLengthValue(obj["unknown7_float"] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown8_float" in obj) {
        flags |= 0x80;
        v = packSignedIntWith2bitLengthValue(obj["unknown8_float"] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown9_float" in obj) {
        flags |= 4;
        v = packSignedIntWith2bitLengthValue(obj["unknown9_float"] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown10_float" in obj) {
        flags |= 8;
        v = packSignedIntWith2bitLengthValue(obj["unknown10_float"] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown11_float" in obj) {
        flags |= 0x10;
        v = packSignedIntWith2bitLengthValue(obj["unknown11_float"] * 10);
        data = Buffer.concat([data, v]);
    }
    if ("unknown12_float" in obj) {
        flags |= 0x100;
        v = packSignedIntWith2bitLengthValue(obj["unknown12_float"][0] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["unknown12_float"][1] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["unknown12_float"][2] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown13_float" in obj) {
        flags |= 0x200;
        v = packSignedIntWith2bitLengthValue(obj["unknown13_float"][0] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["unknown13_float"][1] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["unknown13_float"][2] * 100);
        data = Buffer.concat([data, v]);
        v = packSignedIntWith2bitLengthValue(obj["unknown13_float"][3] * 100);
        data = Buffer.concat([data, v]);
    }
    if ("unknown14_float" in obj) {
        flags |= 0x400;
        v = packSignedIntWith2bitLengthValue(obj["unknown14_float"] * 10);
        data = Buffer.concat([data, v]);
    }
    if ("unknown15_float" in obj) {
        flags |= 0x800;
        v = packSignedIntWith2bitLengthValue(obj["unknown15_float"] * 10);
        data = Buffer.concat([data, v]);
    }
    data.writeUInt16LE(flags, 0);
    return data;
}
function lz4_decompress(data, inSize, outSize) {
    var outdata = new Buffer.alloc(outSize), token, literalLength, matchLength, matchOffset, matchStart, matchEnd, offsetIn = 0, offsetOut = 0;
    while (1) {
        var token = data[offsetIn];
        var literalLength = token >> 4;
        var matchLength = token & 0xf;
        offsetIn++;
        if (literalLength) {
            if (literalLength == 0xf) {
                while (data[offsetIn] == 0xff) {
                    literalLength += 0xff;
                    offsetIn++;
                }
                literalLength += data[offsetIn];
                offsetIn++;
            }
            data.copy(outdata, offsetOut, offsetIn, offsetIn + literalLength);
            offsetIn += literalLength;
            offsetOut += literalLength;
        }
        if (offsetIn < data.length - 2) {
            var matchOffset = data.readUInt16LE(offsetIn);
            offsetIn += 2;
            if (matchLength == 0xf) {
                while (data[offsetIn] == 0xff) {
                    matchLength += 0xff;
                    offsetIn++;
                }
                matchLength += data[offsetIn];
                offsetIn++;
            }
            matchLength += 4;
            var matchStart = offsetOut - matchOffset, matchEnd = offsetOut - matchOffset + matchLength;
            for (var i = matchStart; i < matchEnd; i++) {
                outdata[offsetOut] = outdata[i];
                offsetOut++;
            }
        }
        else {
            break;
        }
    }
    return outdata;
}
var vehicleReferenceDataSchema = [
    {
        name: "move_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                    { name: "unknownByte3", type: "uint8", defaultValue: 0 },
                    { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                    { name: "max_forward", type: "float", defaultValue: 0.0 },
                    { name: "max_reverse", type: "float", defaultValue: 0.0 },
                    { name: "max_dive", type: "float", defaultValue: 0.0 },
                    { name: "max_rise", type: "float", defaultValue: 0.0 },
                    { name: "max_strafe", type: "float", defaultValue: 0.0 },
                    { name: "accel_forward", type: "float", defaultValue: 0.0 },
                    { name: "accel_reverse", type: "float", defaultValue: 0.0 },
                    { name: "accel_dive", type: "float", defaultValue: 0.0 },
                    { name: "accel_rise", type: "float", defaultValue: 0.0 },
                    { name: "accel_strafe", type: "float", defaultValue: 0.0 },
                    { name: "brake_forward", type: "float", defaultValue: 0.0 },
                    { name: "brake_reverse", type: "float", defaultValue: 0.0 },
                    { name: "brake_dive", type: "float", defaultValue: 0.0 },
                    { name: "brake_rise", type: "float", defaultValue: 0.0 },
                    { name: "brake_strafe", type: "float", defaultValue: 0.0 },
                    { name: "move_pitch_rate", type: "float", defaultValue: 0.0 },
                    { name: "move_yaw_rate", type: "float", defaultValue: 0.0 },
                    { name: "move_roll_rate", type: "float", defaultValue: 0.0 },
                    { name: "still_pitch_rate", type: "float", defaultValue: 0.0 },
                    { name: "still_yaw_rate", type: "float", defaultValue: 0.0 },
                    { name: "still_roll_rate", type: "float", defaultValue: 0.0 },
                    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                    { name: "landing_gear_height", type: "uint32", defaultValue: 0 },
                    { name: "vehicle_archetype", type: "uint8", defaultValue: 0 },
                    { name: "movement_mode", type: "uint8", defaultValue: 0 },
                    {
                        name: "change_mode_speed_percent",
                        type: "float",
                        defaultValue: 0.0,
                    },
                    { name: "unknownFloat25", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat26", type: "float", defaultValue: 0.0 },
                    { name: "min_traction", type: "float", defaultValue: 0.0 },
                    { name: "linear_redirect", type: "float", defaultValue: 0.0 },
                    { name: "linear_dampening", type: "float", defaultValue: 0.0 },
                    { name: "hover_power", type: "float", defaultValue: 0.0 },
                    { name: "hover_length", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat32", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat33", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat34", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat35", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat36", type: "float", defaultValue: 0.0 },
                    { name: "dead_zone_size", type: "float", defaultValue: 0.0 },
                    { name: "dead_zone_rate", type: "float", defaultValue: 0.0 },
                    { name: "dead_zone_sensitivity", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat40", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat41", type: "float", defaultValue: 0.0 },
                    { name: "auto_level_roll_rate", type: "float", defaultValue: 0.0 },
                    { name: "camera_shake_intensity", type: "float", defaultValue: 0.0 },
                    { name: "camera_shake_speed", type: "float", defaultValue: 0.0 },
                    {
                        name: "camera_shake_change_speed",
                        type: "float",
                        defaultValue: 0.0,
                    },
                    { name: "unknownFloat46", type: "float", defaultValue: 0.0 },
                    { name: "inward_yaw_mod", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat48", type: "float", defaultValue: 0.0 },
                    { name: "vehicle_strafe_lift", type: "float", defaultValue: 0.0 },
                    {
                        name: "dead_zone_influence_exponent",
                        type: "float",
                        defaultValue: 0.0,
                    },
                    {
                        name: "camera_shake_initial_intensity",
                        type: "float",
                        defaultValue: 0.0,
                    },
                    { name: "unknownFloat52", type: "float", defaultValue: 0.0 },
                    { name: "dampening", type: "floatvector3" },
                    { name: "unknownFloat53", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat54", type: "float", defaultValue: 0.0 },
                    { name: "sprint_lift_sub", type: "float", defaultValue: 0.0 },
                    { name: "sprint_lift_factor", type: "float", defaultValue: 0.0 },
                    { name: "lift_factor", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat58", type: "float", defaultValue: 0.0 },
                    { name: "steer_burst_factor", type: "floatvector3" },
                    { name: "steer_burst_speed", type: "float", defaultValue: 0.0 },
                    { name: "steer_factor", type: "float", defaultValue: 0.0 },
                    { name: "steer_exponent", type: "float", defaultValue: 0.0 },
                    { name: "steer_spin_factor", type: "float", defaultValue: 0.0 },
                    { name: "steer_spin_exponent", type: "float", defaultValue: 0.0 },
                    { name: "steer_lean_factor", type: "float", defaultValue: 0.0 },
                    { name: "steer_lean_turn_factor", type: "float", defaultValue: 0.0 },
                    { name: "steer_compensate_factor", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat67", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat68", type: "float", defaultValue: 0.0 },
                    {
                        name: "angular_dampening_scalar",
                        type: "float",
                        defaultValue: 0.0,
                    },
                    { name: "angular_dampening", type: "floatvector3" },
                    { name: "estimated_max_speed", type: "uint32", defaultValue: 0 },
                    { name: "hill_climb", type: "float", defaultValue: 0.0 },
                    { name: "hill_climb_decay_range", type: "float", defaultValue: 0.0 },
                    { name: "hill_climb_min_power", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat73", type: "float", defaultValue: 0.0 },
                    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword11", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword12", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword13", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword14", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword15", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword16", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword17", type: "uint32", defaultValue: 0 },
                    { name: "wake_effect", type: "uint32", defaultValue: 0 },
                    { name: "debris_effect", type: "uint32", defaultValue: 0 },
                ],
            },
        ],
    },
    {
        name: "dynamics_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "max_velocity", type: "float", defaultValue: 0.0 },
                    { name: "turn_torque", type: "float", defaultValue: 0.0 },
                    { name: "turn_rate", type: "float", defaultValue: 0.0 },
                    { name: "center_of_gravity_y", type: "float", defaultValue: 0.0 },
                ],
            },
        ],
    },
    {
        name: "engine_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "peak_torque", type: "float", defaultValue: 0.0 },
                    { name: "torque_curve_y", type: "float", defaultValue: 0.0 },
                    { name: "engaged_clutch_damp", type: "float", defaultValue: 0.0 },
                    { name: "disengaged_clutch_damp", type: "float", defaultValue: 0.0 },
                    { name: "clutch_strength", type: "float", defaultValue: 0.0 },
                    { name: "reverse_gear", type: "float", defaultValue: 0.0 },
                    { name: "first_gear", type: "float", defaultValue: 0.0 },
                    { name: "second_gear", type: "float", defaultValue: 0.0 },
                    { name: "third_gear", type: "float", defaultValue: 0.0 },
                    { name: "fourth_gear", type: "float", defaultValue: 0.0 },
                    { name: "switch_gear_time", type: "float", defaultValue: 0.0 },
                ],
            },
        ],
    },
    {
        name: "suspension_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "spring_frequency", type: "float", defaultValue: 0.0 },
                    { name: "spring_damper_ratio", type: "float", defaultValue: 0.0 },
                    {
                        name: "hashes",
                        type: "array",
                        fields: [
                            { name: "hash_1", type: "uint32", defaultValue: 0 },
                            { name: "hash_2", type: "uint32", defaultValue: 0 },
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "vehicle_model_mappings",
        type: "array",
        fields: [
            { name: "vehicle_id", type: "uint32", defaultValue: 0 },
            { name: "model_id", type: "uint32", defaultValue: 0 },
        ],
    },
    {
        name: "wheel_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "max_brake", type: "float", defaultValue: 0.0 },
                    { name: "max_hand_brake", type: "float", defaultValue: 0.0 },
                    { name: "max_steer", type: "float", defaultValue: 0.0 },
                    {
                        name: "hashes",
                        type: "array",
                        fields: [
                            { name: "hash_1", type: "uint32", defaultValue: 0 },
                            { name: "hash_2", type: "uint32", defaultValue: 0 },
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "tire_info",
        type: "array",
        fields: [
            { name: "id", type: "uint32", defaultValue: 0 },
            {
                name: "data",
                type: "schema",
                fields: [
                    { name: "id", type: "uint32", defaultValue: 0 },
                    { name: "long_stiff", type: "float", defaultValue: 0.0 },
                    { name: "tire_second", type: "float", defaultValue: 0.0 },
                    {
                        name: "hashes",
                        type: "array",
                        fields: [
                            { name: "hash_1", type: "uint32", defaultValue: 0 },
                            { name: "hash_2", type: "uint32", defaultValue: 0 },
                        ],
                    },
                ],
            },
        ],
    },
    {
        name: "vehicle_move_info_mappings",
        type: "array",
        fields: [
            { name: "vehicle_id", type: "uint32", defaultValue: 0 },
            { name: "move_info", type: "array", elementType: "uint32" },
        ],
    },
];
function parseVehicleReferenceData(data, offset) {
    var dataLength = data.readUInt32LE(offset);
    offset += 4;
    data = data.slice(offset, offset + dataLength);
    var inSize = data.readUInt32LE(0), outSize = data.readUInt32LE(4), compData = data.slice(8);
    data = lz4_decompress(compData, inSize, outSize);
    var result = DataSchema.parse(vehicleReferenceDataSchema, data, 0).result;
    return {
        value: result,
        length: dataLength + 4,
    };
}
function packVehicleReferenceData(obj) {
    var data = DataSchema.pack(vehicleReferenceDataSchema, obj);
    return data;
}
function parseItemAddData(data, offset, referenceData) {
    var itemDataLength = data.readUInt32LE(offset);
    offset += 4;
    var itemData = data.slice(offset, offset + itemDataLength);
    var inSize = itemData.readUInt16LE(0), outSize = itemData.readUInt16LE(2), compData = itemData.slice(4, 4 + inSize), decompData = lz4_decompress(compData, inSize, outSize), itemDefinition = DataSchema.parse(baseItemDefinitionSchema, decompData, 0)
        .result;
    var itemData = parseItemData(itemData, 4 + inSize, referenceData).value;
    return {
        value: {
            itemDefinition: itemDefinition,
            itemData: itemData,
        },
        length: itemDataLength + 4,
    };
}
function packItemAddData(obj) { }
function parseItemDefinitions(data, offset) {
    var itemDataLength = data.readUInt32LE(offset);
    offset += 4;
    var itemData = data.slice(offset, offset + itemDataLength);
    var itemDefinitions = [], item, n = itemData.readUInt32LE(0), itemDataOffset = 4;
    for (var i = 0; i < n; i++) {
        var blockSize = itemData.readUInt16LE(itemDataOffset), blockSizeOut = itemData.readUInt16LE(itemDataOffset + 2), blockData = itemData.slice(itemDataOffset + 4, itemDataOffset + 4 + blockSize), itemDefinitionData = lz4_decompress(blockData, blockSize, blockSizeOut);
        itemDataOffset += 4 + blockSize;
        itemDefinitions.push(DataSchema.parse(baseItemDefinitionSchema, itemDefinitionData, 0).result);
    }
    // var str = "";
    // for (var a in itemDefinitions[0]) {
    //     if (a == "flags1" || a == "flags2") {
    //         for (var j in itemDefinitions[0][a]) {
    //             str += a + "_" + j + "\t";
    //         }
    //     } else {
    //         str += a + "\t";
    //     }
    // }
    // str += "\n";
    // for (var i=0;i<itemDefinitions.length;i++) {
    //     for (var a in itemDefinitions[i]) {
    //         if (a == "flags1" || a == "flags2") {
    //             for (var j in itemDefinitions[i][a]) {
    //                 str += +itemDefinitions[i][a][j] + "\t";
    //             }
    //         } else {
    //             str += itemDefinitions[i][a] + "\t";
    //         }
    //     }
    //     str += "\n";
    // }
    // require("fs").writeFileSync("debug/itemDefinitions.txt", str);
    return {
        value: itemDefinitions,
        length: itemDataLength + 4,
    };
}
function packItemDefinitions(obj) { }
var profileDataSchema = [
    { name: "profileId", type: "uint32", defaultValue: 0 },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "descriptionId", type: "uint32", defaultValue: 0 },
    { name: "type", type: "uint32", defaultValue: 0 },
    { name: "iconId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean1", type: "boolean", defaultValue: false },
    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
    {
        name: "unknownArray1",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownBoolean2", type: "boolean", defaultValue: false },
    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
    { name: "unknownDword11", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean3", type: "boolean", defaultValue: false },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownBoolean4", type: "boolean", defaultValue: false },
    { name: "unknownBoolean5", type: "boolean", defaultValue: false },
    { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
    { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
    { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
    { name: "unknownFloat4", type: "float", defaultValue: 0.0 },
    { name: "unknownDword13", type: "uint32", defaultValue: 0 },
    { name: "unknownFloat5", type: "float", defaultValue: 0.0 },
    { name: "unknownDword14", type: "uint32", defaultValue: 0 },
    { name: "unknownDword15", type: "uint32", defaultValue: 0 },
    { name: "unknownDword16", type: "uint32", defaultValue: 0 },
    { name: "unknownDword17", type: "uint32", defaultValue: 0 },
    { name: "unknownDword18", type: "uint32", defaultValue: 0 },
    { name: "unknownDword19", type: "uint32", defaultValue: 0 },
];
var baseItemDefinitionSchema = [
    { name: "itemId", type: "uint32", defaultValue: 0 },
    {
        name: "flags1",
        type: "bitflags",
        flags: [
            { bit: 0, name: "bit0" },
            { bit: 1, name: "forceDisablePreview" },
            { bit: 2, name: "bit2" },
            { bit: 3, name: "bit3" },
            { bit: 4, name: "bit4" },
            { bit: 5, name: "bit5" },
            { bit: 6, name: "bit6" },
            { bit: 7, name: "noTrade" },
        ],
    },
    {
        name: "flags2",
        type: "bitflags",
        flags: [
            { bit: 0, name: "bit0" },
            { bit: 1, name: "bit1" },
            { bit: 2, name: "bit2" },
            { bit: 3, name: "accountScope" },
            { bit: 4, name: "canEquip" },
            { bit: 5, name: "removeOnUse" },
            { bit: 6, name: "consumeOnUse" },
            { bit: 7, name: "quickUse" },
        ],
    },
    { name: "flags3", type: "uint8", defaultValue: 0 },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "descriptionId", type: "uint32", defaultValue: 0 },
    { name: "contentId", type: "uint32", defaultValue: 0 },
    { name: "imageSetId", type: "uint32", defaultValue: 0 },
    { name: "unknown4", type: "uint32", defaultValue: 0 },
    { name: "hudImageSetId", type: "uint32", defaultValue: 0 },
    { name: "unknown6", type: "uint32", defaultValue: 0 },
    { name: "unknown7", type: "uint32", defaultValue: 0 },
    { name: "cost", type: "uint32", defaultValue: 0 },
    { name: "itemClass", type: "uint32", defaultValue: 0 },
    { name: "profileOverride", type: "uint32", defaultValue: 0 },
    { name: "slot", type: "uint32", defaultValue: 0 },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "modelName", type: "string", defaultValue: "" },
    { name: "textureAlias", type: "string", defaultValue: "" },
    { name: "unknown13", type: "uint8", defaultValue: 0 },
    { name: "unknown14", type: "uint32", defaultValue: 0 },
    { name: "categoryId", type: "uint32", defaultValue: 0 },
    { name: "unknown16", type: "uint32", defaultValue: 0 },
    { name: "unknown17", type: "uint32", defaultValue: 0 },
    { name: "unknown18", type: "uint32", defaultValue: 0 },
    { name: "minProfileRank", type: "uint32", defaultValue: 0 },
    { name: "unknown19", type: "uint32", defaultValue: 0 },
    { name: "activatableAbililtyId", type: "uint32", defaultValue: 0 },
    { name: "passiveAbilityId", type: "uint32", defaultValue: 0 },
    { name: "passiveAbilitySetId", type: "uint32", defaultValue: 0 },
    { name: "maxStackable", type: "uint32", defaultValue: 0 },
    { name: "tintAlias", type: "string", defaultValue: "" },
    { name: "unknown23", type: "uint32", defaultValue: 0 },
    { name: "unknown24", type: "uint32", defaultValue: 0 },
    { name: "unknown25", type: "uint32", defaultValue: 0 },
    { name: "unknown26", type: "uint32", defaultValue: 0 },
    { name: "uiModelCameraId", type: "uint32", defaultValue: 0 },
    { name: "equipCountMax", type: "uint32", defaultValue: 0 },
    { name: "currencyType", type: "uint32", defaultValue: 0 },
    { name: "dataSheetId", type: "uint32", defaultValue: 0 },
    { name: "itemType", type: "uint32", defaultValue: 0 },
    { name: "skillSetId", type: "uint32", defaultValue: 0 },
    { name: "overlayTexture", type: "string", defaultValue: "" },
    { name: "decalSlot", type: "string", defaultValue: "" },
    { name: "overlayAdjustment", type: "uint32", defaultValue: 0 },
    { name: "trialDurationSec", type: "uint32", defaultValue: 0 },
    { name: "nextTrialDelaySec", type: "uint32", defaultValue: 0 },
    { name: "clientUseRequirementId", type: "uint32", defaultValue: 0 },
    { name: "overrideAppearance", type: "string", defaultValue: "" },
    { name: "unknown35", type: "uint32", defaultValue: 0 },
    { name: "unknown36", type: "uint32", defaultValue: 0 },
    { name: "param1", type: "uint32", defaultValue: 0 },
    { name: "param2", type: "uint32", defaultValue: 0 },
    { name: "param3", type: "uint32", defaultValue: 0 },
    { name: "uiModelCameraId2", type: "uint32", defaultValue: 0 },
    { name: "unknown41", type: "uint32", defaultValue: 0 },
];
var lightWeightNpcSchema = [
    { name: "guid", type: "uint64", defaultValue: "0" },
    {
        name: "transientId",
        type: "custom",
        parser: readUnsignedIntWith2bitLengthValue,
        packer: packUnsignedIntWith2bitLengthValue,
    },
    { name: "unknownString0", type: "string", defaultValue: "" },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "modelId", type: "uint32", defaultValue: 0 },
    { name: "scale", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
    { name: "unknownString1", type: "string", defaultValue: "" },
    { name: "unknownString2", type: "string", defaultValue: "" },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    // { name: "unknownString3",   type: "string" , defaultValue : ""},
    { name: "position", type: "floatvector3" },
    { name: "unknownVector1", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
    { name: "rotation", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
];
var profileStatsSubSchema1 = [
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownArray1", type: "array", elementType: "uint32" },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
];
var weaponStatsDataSubSchema1 = [
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
    { name: "unknownDword11", type: "uint32", defaultValue: 0 },
    { name: "unknownDword12", type: "uint32", defaultValue: 0 },
    { name: "unknownDword13", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean1", type: "boolean", defaultValue: false },
    { name: "unknownDword14", type: "uint32", defaultValue: 0 },
];
var weaponStatsDataSchema = [
    { name: "unknownData1", type: "schema", fields: profileStatsSubSchema1 },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
    { name: "unknownDword11", type: "uint32", defaultValue: 0 },
    { name: "unknownData2", type: "schema", fields: weaponStatsDataSubSchema1 },
    { name: "unknownData3", type: "schema", fields: weaponStatsDataSubSchema1 },
];
var vehicleStatsDataSchema = [
    { name: "unknownData1", type: "schema", fields: profileStatsSubSchema1 },
    { name: "unknownData2", type: "schema", fields: weaponStatsDataSubSchema1 },
];
var facilityStatsDataSchema = [
    { name: "unknownData1", type: "schema", fields: weaponStatsDataSubSchema1 },
];
var itemBaseSchema = [
    { name: "itemId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean1", type: "boolean", defaultValue: false },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    {
        name: "unknownData",
        type: "variabletype8",
        types: {
            0: [],
            1: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
            ],
        },
    },
];
var effectTagDataSchema = [
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
            { name: "unknownGuid2", type: "uint64", defaultValue: "0" },
        ],
    },
    {
        name: "unknownData2",
        type: "schema",
        fields: [
            { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
            { name: "unknownGuid2", type: "uint64", defaultValue: "0" },
            {
                name: "unknownVector1",
                type: "floatvector4",
                defaultValue: [0, 0, 0, 0],
            },
        ],
    },
    {
        name: "unknownData3",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
];
var targetDataSchema = [{ name: "targetType", type: "uint8", defaultValue: 0 }];
var itemDetailSchema = [
    { name: "unknownBoolean1", type: "boolean", defaultValue: false },
];
var statDataSchema = [
    { name: "statId", type: "uint32", defaultValue: 0 },
    {
        name: "statValue",
        type: "variabletype8",
        types: {
            0: [
                { name: "baseValue", type: "uint32", defaultValue: 0 },
                { name: "modifierValue", type: "uint32", defaultValue: 0 },
            ],
            1: [
                { name: "baseValue", type: "float", defaultValue: 0.0 },
                { name: "modifierValue", type: "float", defaultValue: 0.0 },
            ],
        },
    },
];
var itemWeaponDetailSubSchema1 = [
    { name: "statOwnerId", type: "uint32", defaultValue: 0 },
    { name: "statData", type: "schema", fields: statDataSchema },
];
var itemWeaponDetailSubSchema2 = [
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    {
        name: "unknownArray1",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            {
                name: "unknownArray1",
                type: "array",
                fields: itemWeaponDetailSubSchema1,
            },
        ],
    },
];
var itemWeaponDetailSchema = [
    { name: "unknownBoolean1", type: "boolean", defaultValue: false },
    {
        name: "unknownArray1",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
        ],
    },
    {
        name: "unknownArray2",
        type: "array8",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            {
                name: "unknownArray1",
                type: "array8",
                fields: [
                    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                ],
            },
        ],
    },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownByte3", type: "uint8", defaultValue: 0 },
    { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
    { name: "unknownByte4", type: "uint8", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownArray3", type: "array", fields: itemWeaponDetailSubSchema1 },
    { name: "unknownArray4", type: "array", fields: itemWeaponDetailSubSchema2 },
];
var weaponPackets = [
    [
        "Weapon.FireStateUpdate",
        0x8201,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["Weapon.FireStateTargetedUpdate", 0x8202, { fields: [] }],
    [
        "Weapon.Fire",
        0x8203,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "position", type: "floatvector3" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Weapon.FireWithDefinitionMapping", 0x8204, { fields: [] }],
    ["Weapon.FireNoProjectile", 0x8205, { fields: [] }],
    ["Weapon.ProjectileHitReport", 0x8206, { fields: [] }],
    [
        "Weapon.ReloadRequest",
        0x8207,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["Weapon.Reload", 0x8208, { fields: [] }],
    ["Weapon.ReloadInterrupt", 0x8209, { fields: [] }],
    ["Weapon.ReloadComplete", 0x820a, { fields: [] }],
    [
        "Weapon.SwitchFireModeRequest",
        0x820b,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                { name: "unknownByte3", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["Weapon.LockOnGuidUpdate", 0x820c, { fields: [] }],
    ["Weapon.LockOnLocationUpdate", 0x820d, { fields: [] }],
    [
        "Weapon.StatUpdate",
        0x820e,
        {
            fields: [
                {
                    name: "statData",
                    type: "array",
                    fields: [
                        { name: "guid", type: "uint64", defaultValue: "0" },
                        { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                        {
                            name: "statUpdates",
                            type: "array",
                            fields: [
                                { name: "statCategory", type: "uint8", defaultValue: 0 },
                                {
                                    name: "statUpdateData",
                                    type: "schema",
                                    fields: itemWeaponDetailSubSchema1,
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    ["Weapon.DebugProjectile", 0x820f, { fields: [] }],
    ["Weapon.AddFireGroup", 0x8210, { fields: [] }],
    ["Weapon.RemoveFireGroup", 0x8211, { fields: [] }],
    ["Weapon.ReplaceFireGroup", 0x8212, { fields: [] }],
    ["Weapon.GuidedUpdate", 0x8213, { fields: [] }],
    ["Weapon.RemoteWeapon.Reset", 0x821401, { fields: [] }],
    ["Weapon.RemoteWeapon.AddWeapon", 0x821402, { fields: [] }],
    ["Weapon.RemoteWeapon.RemoveWeapon", 0x821403, { fields: [] }],
    [
        "Weapon.RemoteWeapon.Update",
        0x821404,
        {
            fields: [
                {
                    name: "unknownUint1",
                    type: "custom",
                    parser: readUnsignedIntWith2bitLengthValue,
                    packer: packUnsignedIntWith2bitLengthValue,
                },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                {
                    name: "unknownUint2",
                    type: "custom",
                    parser: readUnsignedIntWith2bitLengthValue,
                    packer: packUnsignedIntWith2bitLengthValue,
                },
            ],
        },
    ],
    ["Weapon.RemoteWeapon.Update.FireState", 0x82140401, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.Empty", 0x82140402, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.Reload", 0x82140403, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.ReloadLoopEnd", 0x82140404, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.ReloadInterrupt", 0x82140405, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.SwitchFireMode", 0x82140406, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.StatUpdate", 0x82140407, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.AddFireGroup", 0x82140408, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.RemoveFireGroup", 0x82140409, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.ReplaceFireGroup", 0x8214040a, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.ProjectileLaunch", 0x8214040b, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.Chamber", 0x8214040c, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.Throw", 0x8214040d, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.Trigger", 0x8214040e, { fields: [] }],
    ["Weapon.RemoteWeapon.Update.ChamberInterrupt", 0x8214040f, { fields: [] }],
    ["Weapon.RemoteWeapon.ProjectileLaunchHint", 0x821405, { fields: [] }],
    ["Weapon.RemoteWeapon.ProjectileDetonateHint", 0x821406, { fields: [] }],
    [
        "Weapon.RemoteWeapon.ProjectileRemoteContactReport",
        0x821407,
        { fields: [] },
    ],
    ["Weapon.ChamberRound", 0x8215, { fields: [] }],
    ["Weapon.GuidedSetNonSeeking", 0x8216, { fields: [] }],
    ["Weapon.ChamberInterrupt", 0x8217, { fields: [] }],
    ["Weapon.GuidedExplode", 0x8218, { fields: [] }],
    ["Weapon.DestroyNpcProjectile", 0x8219, { fields: [] }],
    ["Weapon.WeaponToggleEffects", 0x821a, { fields: [] }],
    [
        "Weapon.Reset",
        0x821b,
        {
            fields: [
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["Weapon.ProjectileSpawnNpc", 0x821c, { fields: [] }],
    ["Weapon.FireRejected", 0x821d, { fields: [] }],
    [
        "Weapon.MultiWeapon",
        0x821e,
        {
            fields: [
                {
                    name: "packets",
                    type: "custom",
                    parser: parseMultiWeaponPacket,
                    packer: packMultiWeaponPacket,
                },
            ],
        },
    ],
    ["Weapon.WeaponFireHint", 0x821f, { fields: [] }],
    ["Weapon.ProjectileContactReport", 0x8220, { fields: [] }],
    ["Weapon.MeleeHitMaterial", 0x8221, { fields: [] }],
    ["Weapon.ProjectileSpawnAttachedNp", 0x8222, { fields: [] }],
    ["Weapon.AddDebugLogEntry", 0x8223, { fields: [] }],
];
var weaponPacketTypes = {}, weaponPacketDescriptors = {};
PacketTable.build(weaponPackets, weaponPacketTypes, weaponPacketDescriptors);
function parseMultiWeaponPacket(data, offset) {
    var startOffset = offset, packets = [];
    var n = data.readUInt32LE(offset);
    offset += 4;
    for (var i = 0; i < n; i++) {
        var size = data.readUInt32LE(offset);
        offset += 4;
        var subData = data.slice(offset, offset + size);
        offset += size;
        packets.push(parseWeaponPacket(subData, 2).value);
    }
    return {
        value: packets,
        length: startOffset - offset,
    };
}
function packMultiWeaponPacket(obj) { }
function parseWeaponPacket(data, offset) {
    var obj = {};
    obj.gameTime = data.readUInt32LE(offset);
    var tmpData = data.slice(offset + 4);
    var weaponPacketData = new Buffer.alloc(tmpData.length + 1);
    weaponPacketData.writeUInt8(0x85, 0);
    tmpData.copy(weaponPacketData, 1);
    var weaponPacket = readPacketType(weaponPacketData, weaponPacketDescriptors);
    if (weaponPacket.packet) {
        obj.packetType = weaponPacket.packetType;
        obj.packetName = weaponPacket.packet.name;
        if (weaponPacket.packet.schema) {
            obj.packet = DataSchema.parse(weaponPacket.packet.schema, weaponPacketData, weaponPacket.length, null).result;
        }
    }
    else {
        obj.packetType = weaponPacket.packetType;
        obj.packetData = data;
    }
    return {
        value: obj,
        length: data.length - offset,
    };
}
function packWeaponPacket(obj) {
    var subObj = obj.packet, subName = obj.packetName, subType = weaponPacketTypes[subName], data;
    if (weaponPacketDescriptors[subType]) {
        var subPacket = weaponPacketDescriptors[subType], subTypeData = writePacketType(subType), subData = DataSchema.pack(subPacket.schema, subObj).data;
        subData = Buffer.concat([subTypeData.slice(1), subData]);
        data = new Buffer.alloc(subData.length + 4);
        data.writeUInt32LE((obj.gameTime & 0xffffffff) >>> 0, 0);
        subData.copy(data, 4);
    }
    else {
        throw "Unknown weapon packet type: " + subType;
    }
    return data;
}
function parseItemData(data, offset, referenceData) {
    var startOffset = offset, detailItem, detailSchema;
    var baseItem = DataSchema.parse(itemBaseSchema, data, offset);
    offset += baseItem.length;
    if (referenceData &&
        referenceData.itemTypes[baseItem.result.itemId] == "Weapon") {
        detailSchema = itemWeaponDetailSchema;
    }
    else {
        detailSchema = itemDetailSchema;
    }
    detailItem = DataSchema.parse(detailSchema, data, offset);
    offset += detailItem.length;
    return {
        value: {
            baseItem: baseItem.result,
            detail: detailItem.result,
        },
        length: offset - startOffset,
    };
}
function packItemData(obj, referenceData) {
    var baseData = DataSchema.pack(itemBaseSchema, obj.baseItem), detailData, detailSchema;
    if (referenceData &&
        referenceData.itemTypes[obj.baseItem.itemId] == "Weapon") {
        detailSchema = itemWeaponDetailSchema;
    }
    else {
        detailSchema = itemDetailSchema;
    }
    detailData = DataSchema.pack(detailSchema, obj.detail);
    return Buffer.concat([baseData.data, detailData.data]);
}
var resourceEventDataSubSchema = [
    {
        name: "resourceData",
        type: "schema",
        fields: [
            { name: "resourceId", type: "uint32", defaultValue: 0 },
            { name: "resourceType", type: "uint32", defaultValue: 0 },
        ],
    },
    {
        name: "unknownArray1",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            {
                name: "unknownData1",
                type: "schema",
                fields: [
                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                    { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                    { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                ],
            },
        ],
    },
    {
        name: "unknownData2",
        type: "schema",
        fields: [
            { name: "max_value", type: "uint32", defaultValue: 0 },
            { name: "initial_value", type: "uint32", defaultValue: 0 },
            { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
            { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
            { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
            { name: "unknownDword4", type: "uint32", defaultValue: 0 },
            { name: "unknownDword5", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    { name: "unknownTime1", type: "uint64", defaultValue: "0" },
    { name: "unknownTime2", type: "uint64", defaultValue: "0" },
    { name: "unknownTime3", type: "uint64", defaultValue: "0" },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
];
var rewardBundleDataSchema = [
    { name: "unknownByte1", type: "boolean", defaultValue: false },
    {
        name: "currency",
        type: "array",
        fields: [
            { name: "currencyId", type: "uint32", defaultValue: 0 },
            { name: "quantity", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "time", type: "uint64", defaultValue: "0" },
    { name: "characterId", type: "uint64", defaultValue: "0" },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    { name: "imageSetId", type: "uint32", defaultValue: 0 },
    {
        name: "entries",
        type: "array",
        fields: [
            {
                name: "entryData",
                type: "variabletype8",
                types: {
                    1: [
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: [
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                                { name: "imageSetId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                { name: "quantity", type: "uint32", defaultValue: 0 },
                                { name: "itemId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                            ],
                        },
                    ],
                },
            },
        ],
    },
    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
];
var objectiveDataSchema = [
    { name: "objectiveId", type: "uint32", defaultValue: 0 },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "descriptionId", type: "uint32", defaultValue: 0 },
    { name: "rewardData", type: "schema", fields: rewardBundleDataSchema },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    { name: "unknownByte3", type: "uint8", defaultValue: 0 },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
            { name: "unknownDword4", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownByte4", type: "uint8", defaultValue: 0 },
];
var achievementDataSchema = [
    { name: "achievementId", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean1", type: "uint32", defaultValue: 0 },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "descriptionId", type: "uint32", defaultValue: 0 },
    { name: "timeStarted", type: "uint64", defaultValue: "0" },
    { name: "timeFinished", type: "uint64", defaultValue: "0" },
    { name: "progress", type: "float", defaultValue: 0.0 },
    {
        name: "objectives",
        type: "array",
        fields: [
            { name: "index", type: "uint32", defaultValue: 0 },
            { name: "objectiveData", type: "schema", fields: objectiveDataSchema },
        ],
    },
    { name: "iconId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "points", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    { name: "unknownBoolean2", type: "boolean", defaultValue: false },
    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
];
var loadoutDataSubSchema1 = [
    { name: "loadoutId", type: "uint32", defaultValue: 0 },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
        ],
    },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    {
        name: "unknownData2",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "loadoutName", type: "string", defaultValue: "" },
        ],
    },
    { name: "tintItemId", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "decalItemId", type: "uint32", defaultValue: 0 },
    {
        name: "loadoutSlots",
        type: "array",
        fields: [
            { name: "loadoutSlotId", type: "uint32", defaultValue: 0 },
            {
                name: "loadoutSlotData",
                type: "schema",
                fields: [
                    { name: "index", type: "uint32", defaultValue: 0 },
                    {
                        name: "loadoutSlotItem",
                        type: "schema",
                        fields: [
                            { name: "itemLineId", type: "uint32", defaultValue: 0 },
                            { name: "flags", type: "uint8", defaultValue: 0 },
                            {
                                name: "attachments",
                                type: "array",
                                fields: [
                                    { name: "attachmentId", type: "uint32", defaultValue: 0 },
                                ],
                            },
                            {
                                name: "attachmentClasses",
                                type: "array",
                                fields: [
                                    { name: "classId", type: "uint32", defaultValue: 0 },
                                    { name: "attachmentId", type: "uint32", defaultValue: 0 },
                                ],
                            },
                        ],
                    },
                    { name: "tintItemId", type: "uint32", defaultValue: 0 },
                    { name: "itemSlot", type: "uint32", defaultValue: 0 },
                ],
            },
        ],
    },
];
var loadoutDataSubSchema2 = [
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
        ],
    },
    { name: "unknownString1", type: "string", defaultValue: "" },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    {
        name: "unknownArray1",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            {
                name: "unknownData1",
                type: "schema",
                fields: [
                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                    {
                        name: "unknownData1",
                        type: "schema",
                        fields: [
                            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            {
                                name: "unknownArray1",
                                type: "array",
                                fields: [
                                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                ],
                            },
                            {
                                name: "unknownArray2",
                                type: "array",
                                fields: [
                                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                ],
                            },
                        ],
                    },
                    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                ],
            },
        ],
    },
];
var fullNpcDataSchema = [
    {
        name: "transient_id",
        type: "custom",
        parser: readUnsignedIntWith2bitLengthValue,
        packer: packUnsignedIntWith2bitLengthValue,
    },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    {
        name: "attachments",
        type: "array",
        fields: [
            { name: "unknownString1", type: "string", defaultValue: "" },
            { name: "unknownString2", type: "string", defaultValue: "" },
            { name: "unknownString3", type: "string", defaultValue: "" },
            { name: "unknownString4", type: "string", defaultValue: "" },
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownString1", type: "string", defaultValue: "" },
    { name: "unknownString2", type: "string", defaultValue: "" },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
    { name: "unknownDword5", type: "uint32", defaultValue: 0 },
    { name: "unknownVector1", type: "floatvector3" },
    { name: "unknownVector2", type: "floatvector3" },
    { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
    { name: "unknownDword6", type: "uint32", defaultValue: 0 },
    { name: "unknownDword7", type: "uint32", defaultValue: 0 },
    { name: "unknownDword8", type: "uint32", defaultValue: 0 },
    {
        name: "effectTags",
        type: "array",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
            { name: "unknownDword4", type: "uint32", defaultValue: 0 },
            { name: "unknownDword5", type: "uint32", defaultValue: 0 },
            { name: "unknownDword6", type: "uint32", defaultValue: 0 },
            { name: "unknownDword7", type: "uint32", defaultValue: 0 },
            { name: "unknownDword8", type: "uint32", defaultValue: 0 },
            { name: "unknownDword9", type: "uint32", defaultValue: 0 },
            { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
            { name: "unknownDword10", type: "uint32", defaultValue: 0 },
            { name: "unknownQword1", type: "uint64", defaultValue: "0" },
            { name: "unknownQword2", type: "uint64", defaultValue: "0" },
            { name: "unknownQword3", type: "uint64", defaultValue: "0" },
            { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
            { name: "unknownDword11", type: "uint32", defaultValue: 0 },
            { name: "unknownDword12", type: "uint32", defaultValue: 0 },
            { name: "unknownDword13", type: "uint32", defaultValue: 0 },
            { name: "unknownDword14", type: "uint32", defaultValue: 0 },
            { name: "unknownDword15", type: "uint32", defaultValue: 0 },
            { name: "unknownDword16", type: "uint32", defaultValue: 0 },
            { name: "unknownDword17", type: "uint32", defaultValue: 0 },
            { name: "unknownGuid2", type: "uint64", defaultValue: "0" },
            { name: "unknownDword18", type: "uint32", defaultValue: 0 },
            { name: "unknownDword19", type: "uint32", defaultValue: 0 },
            { name: "unknownDword20", type: "uint32", defaultValue: 0 },
            { name: "unknownDword21", type: "uint32", defaultValue: 0 },
            { name: "unknownGuid3", type: "uint64", defaultValue: "0" },
            { name: "unknownGuid4", type: "uint64", defaultValue: "0" },
            { name: "unknownDword22", type: "uint32", defaultValue: 0 },
            { name: "unknownQword4", type: "uint64", defaultValue: "0" },
            { name: "unknownDword23", type: "uint32", defaultValue: 0 },
        ],
    },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            { name: "unknownString1", type: "string", defaultValue: "" },
            { name: "unknownString2", type: "string", defaultValue: "" },
            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
            { name: "unknownString3", type: "string", defaultValue: "" },
        ],
    },
    { name: "unknownVector4", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
    { name: "unknownDword9", type: "uint32", defaultValue: 0 },
    { name: "unknownDword10", type: "uint32", defaultValue: 0 },
    { name: "unknownDword11", type: "uint32", defaultValue: 0 },
    { name: "characterId", type: "uint64", defaultValue: "0" },
    { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
    { name: "targetData", type: "schema", fields: targetDataSchema },
    {
        name: "characterVariables",
        type: "array",
        fields: [
            { name: "unknownString1", type: "string", defaultValue: "" },
            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
        ],
    },
    { name: "unknownDword12", type: "uint32", defaultValue: 0 },
    { name: "unknownFloat4", type: "float", defaultValue: 0.0 },
    { name: "unknownVector5", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
    { name: "unknownDword13", type: "uint32", defaultValue: 0 },
    { name: "unknownFloat5", type: "float", defaultValue: 0.0 },
    { name: "unknownFloat6", type: "float", defaultValue: 0.0 },
    {
        name: "unknownData2",
        type: "schema",
        fields: [{ name: "unknownFloat1", type: "float", defaultValue: 0.0 }],
    },
    { name: "unknownDword14", type: "uint32", defaultValue: 0 },
    { name: "unknownDword15", type: "uint32", defaultValue: 0 },
    { name: "unknownDword16", type: "uint32", defaultValue: 0 },
    { name: "unknownDword17", type: "uint32", defaultValue: 0 },
    { name: "unknownDword18", type: "uint32", defaultValue: 0 },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    { name: "unknownDword19", type: "uint32", defaultValue: 0 },
    { name: "unknownDword20", type: "uint32", defaultValue: 0 },
    { name: "unknownDword21", type: "uint32", defaultValue: 0 },
    { name: "resources", type: "array", fields: resourceEventDataSubSchema },
    { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
    {
        name: "unknownData3",
        type: "schema",
        fields: [{ name: "unknownDword1", type: "uint32", defaultValue: 0 }],
    },
    { name: "unknownDword22", type: "uint32", defaultValue: 0 },
    { name: "unknownBytes1", type: "byteswithlength" },
    { name: "unknownBytes2", type: "byteswithlength" },
];
var respawnLocationDataSchema = [
    { name: "guid", type: "uint64", defaultValue: "0" },
    { name: "respawnType", type: "uint8", defaultValue: 0 },
    { name: "position", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
    { name: "unknownDword2", type: "uint32", defaultValue: 0 },
    { name: "iconId1", type: "uint32", defaultValue: 0 },
    { name: "iconId2", type: "uint32", defaultValue: 0 },
    { name: "respawnTotalTime", type: "uint32", defaultValue: 0 },
    { name: "unknownDword3", type: "uint32", defaultValue: 0 },
    { name: "nameId", type: "uint32", defaultValue: 0 },
    { name: "distance", type: "float", defaultValue: 0.0 },
    { name: "unknownByte1", type: "uint8", defaultValue: 0 },
    { name: "unknownByte2", type: "uint8", defaultValue: 0 },
    {
        name: "unknownData1",
        type: "schema",
        fields: [
            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
            { name: "unknownByte2", type: "uint8", defaultValue: 0 },
            { name: "unknownByte3", type: "uint8", defaultValue: 0 },
            { name: "unknownByte4", type: "uint8", defaultValue: 0 },
            { name: "unknownByte5", type: "uint8", defaultValue: 0 },
        ],
    },
    { name: "unknownDword4", type: "uint32", defaultValue: 0 },
    { name: "unknownByte3", type: "uint8", defaultValue: 0 },
    { name: "unknownByte4", type: "uint8", defaultValue: 0 },
];
var packets = [
    ["Server", 0x01, { fields: [] }],
    ["ClientFinishedLoading", 0x02, { fields: [] }],
    [
        "SendSelfToClient",
        0x03,
        {
            fields: [
                {
                    name: "data",
                    type: "byteswithlength",
                    fields: [
                        { name: "guid", type: "uint64", defaultValue: 0 },
                        { name: "characterId", type: "uint64", defaultValue: 0 },
                        {
                            name: "unknownUint1",
                            type: "custom",
                            parser: readUnsignedIntWith2bitLengthValue,
                            packer: packUnsignedIntWith2bitLengthValue,
                        },
                        { name: "lastLoginDate", type: "uint64", defaultValue: 0 },
                        { name: "actorModelId", type: "uint32", defaultValue: 0 },
                        { name: "headActor", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        { name: "unknownString2", type: "string", defaultValue: "" },
                        { name: "unknownString3", type: "string", defaultValue: "" },
                        { name: "unknownString4", type: "string", defaultValue: "" },
                        { name: "headId", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "factionId", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                        { name: "position", type: "floatvector4", defaultValue: 0 },
                        { name: "characterVector", type: "floatvector4", defaultValue: 0 },
                        {
                            name: "identity",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "characterName", type: "string", defaultValue: "" },
                                { name: "characterNameBis", type: "string", defaultValue: "" },
                            ],
                        },
                        { name: "unknownDword14", type: "uint32", defaultValue: 0 },
                        {
                            name: "currency",
                            type: "array",
                            fields: [
                                { name: "currencyId", type: "uint32", defaultValue: 0 },
                                { name: "quantity", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "creationDate", type: "uint64", defaultValue: 0 },
                        { name: "unknownDword15", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword16", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean1", type: "boolean", defaultValue: true },
                        { name: "unknownBoolean2", type: "boolean", defaultValue: true },
                        { name: "unknownDword17", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword18", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean3", type: "boolean", defaultValue: true },
                        { name: "unknownDword19", type: "uint32", defaultValue: 0 },
                        { name: "gender", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword21", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword22", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword23", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean4", type: "boolean", defaultValue: true },
                        { name: "unknownTime1", type: "uint64", defaultValue: 0 },
                        { name: "unknownTime2", type: "uint64", defaultValue: 0 },
                        { name: "unknownTime3", type: "uint64", defaultValue: 0 },
                        { name: "unknownDword24", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean5", type: "boolean", defaultValue: true },
                        { name: "unknownDword25", type: "uint32", defaultValue: 0 },
                        { name: "profiles", type: "array", fields: profileDataSchema },
                        { name: "currentProfile", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownArray2",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "int32", defaultValue: 0 },
                                { name: "unknownDword2", type: "int32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "collections",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: rewardBundleDataSchema,
                                },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword5",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword6",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword7",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownBoolean1",
                                                    type: "boolean",
                                                    defaultValue: true,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "inventory",
                            type: "schema",
                            fields: [
                                {
                                    name: "items",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "itemData",
                                            type: "custom",
                                            parser: parseItemData,
                                            packer: packItemData,
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownDword28", type: "uint32", defaultValue: 0 },
                        {
                            name: "characterQuests",
                            type: "schema",
                            fields: [
                                {
                                    name: "quests",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean1",
                                            type: "boolean",
                                            defaultValue: true,
                                        },
                                        { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean2",
                                            type: "boolean",
                                            defaultValue: true,
                                        },
                                        { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                        {
                                            name: "reward",
                                            type: "schema",
                                            fields: rewardBundleDataSchema,
                                        },
                                        {
                                            name: "unknownArray2",
                                            type: "array",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownBoolean1",
                                                    type: "boolean",
                                                    defaultValue: true,
                                                },
                                                {
                                                    name: "reward",
                                                    type: "schema",
                                                    fields: rewardBundleDataSchema,
                                                },
                                                {
                                                    name: "unknownDword14",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword15",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword16",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword17",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownBoolean4",
                                                    type: "boolean",
                                                    defaultValue: true,
                                                },
                                                {
                                                    name: "unknownDword18",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword19",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword20",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword21",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean3",
                                            type: "boolean",
                                            defaultValue: true,
                                        },
                                        {
                                            name: "unknownBoolean4",
                                            type: "boolean",
                                            defaultValue: true,
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "characterAchievements",
                            type: "array",
                            fields: achievementDataSchema,
                        },
                        {
                            name: "acquaintances",
                            type: "array",
                            fields: [
                                { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownGuid2", type: "uint64", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                            ],
                        },
                        {
                            name: "recipes",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                {
                                    name: "components",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                        { name: "unknownQword1", type: "uint64", defaultValue: 0 },
                                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "mounts",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownQword1", type: "uint64", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                            ],
                        },
                        {
                            name: "unknownCoinStoreData",
                            type: "schema",
                            fields: [
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "unknownArray10",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownEffectArray",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword5",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword6",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword7",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword8",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword9",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownFloat1",
                                                    type: "float",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword10",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownQword1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownQword2",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownQword3",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword11",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword12",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword13",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword14",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword15",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword16",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword17",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid2",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword18",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword19",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword20",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid3",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid4",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword21",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownQword4",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword22",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean1",
                                            type: "boolean",
                                            defaultValue: true,
                                        },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownArray1",
                                            type: "array",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "stats",
                            type: "array",
                            fields: [
                                { name: "statId", type: "uint32", defaultValue: 0 },
                                {
                                    name: "statData",
                                    type: "schema",
                                    fields: [
                                        { name: "statId", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "statValue",
                                            type: "variabletype8",
                                            types: {
                                                0: [
                                                    { name: "base", type: "uint32", defaultValue: 0 },
                                                    { name: "modifier", type: "uint32", defaultValue: 0 },
                                                ],
                                                1: [
                                                    { name: "base", type: "float", defaultValue: 0 },
                                                    { name: "modifier", type: "float", defaultValue: 0 },
                                                ],
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "playerTitles",
                            type: "array",
                            fields: [
                                { name: "titleId", type: "uint32", defaultValue: 0 },
                                { name: "titleType", type: "uint32", defaultValue: 0 },
                                { name: "stringId", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "currentPlayerTitle", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownArray13",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray14",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownDword33", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownArray15",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray16",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray17",
                            type: "array",
                            fields: [
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: true,
                                },
                            ],
                        },
                        // { name: "unknownDword34",           type: "uint32" , defaultValue: 0 },
                        // { name: "unknownDword35",           type: "uint32" , defaultValue: 0 },
                        // { name: "unknownDword36",           type: "uint32" , defaultValue: 0 },
                        {
                            name: "unknownArray18",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray19",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray20",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: [
                                {
                                    name: "abilityLines",
                                    type: "array",
                                    fields: [
                                        { name: "abilityLineId", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "abilityLineData",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "abilityLineId",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                { name: "abilityId", type: "uint32", defaultValue: 0 },
                                                {
                                                    name: "abilityLineIndex",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray3",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray4",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownArray5",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid2",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray6",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray7",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "unknownArray21",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray22",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray23",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                        {
                            name: "unknownData2",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownData2",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownDword37", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownArray24",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownFloat1", type: "float", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownData3",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray25",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                { name: "unknownFloat2", type: "float", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownArray26",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "unknownArray27",
                            type: "array",
                            fields: [
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                        { name: "unknownGuid2", type: "uint64", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "effectTagData",
                                    type: "schema",
                                    fields: effectTagDataSchema,
                                },
                            ],
                        },
                        {
                            name: "unknownArray28",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        {
                                            name: "unknownString1",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                        {
                                            name: "unknownString2",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownGuid1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownString1",
                                                    type: "string",
                                                    defaultValue: "",
                                                },
                                                {
                                                    name: "unknownString2",
                                                    type: "string",
                                                    defaultValue: "",
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "playerRanks",
                            type: "array",
                            fields: [
                                { name: "rankId", type: "uint32", defaultValue: 0 },
                                {
                                    name: "rankData",
                                    type: "schema",
                                    fields: [
                                        { name: "rankId", type: "uint32", defaultValue: 0 },
                                        { name: "score", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "rank", type: "uint32", defaultValue: 0 },
                                        { name: "rankProgress", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "unknownData4",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "unknownData5",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "implantSlots",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "itemTimerData",
                            type: "schema",
                            fields: [
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                        { name: "unknownTime1", type: "uint64", defaultValue: 0 },
                                        { name: "unknownTime2", type: "uint64", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownFloat1",
                                                    type: "float",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime2",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownData2",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                        { name: "unknownTime1", type: "uint64", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownFloat1",
                                                    type: "float",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray3",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownFloat1",
                                                    type: "float",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray4",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownFloat1",
                                                    type: "float",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                    ],
                                },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "characterLoadoutData",
                            type: "schema",
                            fields: [
                                {
                                    name: "loadouts",
                                    type: "array",
                                    fields: [
                                        { name: "loadoutId", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "loadoutData",
                                            type: "schema",
                                            fields: loadoutDataSubSchema1,
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: loadoutDataSubSchema2,
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray3",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownArray1",
                                                    type: "array",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownArray2",
                                                    type: "array",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: loadoutDataSubSchema1,
                                },
                                {
                                    name: "unknownData2",
                                    type: "schema",
                                    fields: loadoutDataSubSchema2,
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "missionData",
                            type: "schema",
                            fields: [
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownFloat1", type: "float", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray3",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                            ],
                                        },
                                        { name: "unknownGuid1", type: "uint64", defaultValue: 0 },
                                    ],
                                },
                                {
                                    name: "unknownArray4",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownData1",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownTime1",
                                                            type: "uint64",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownByte1",
                                                            type: "uint8",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownData2",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownTime1",
                                                            type: "uint64",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownByte1",
                                                            type: "uint8",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownData3",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword3",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownData4",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword3",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword4",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownVector1",
                                                            type: "floatvector4",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    name: "unknownArray5",
                                    type: "array",
                                    fields: [
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownData1",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownTime1",
                                                            type: "uint64",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownByte1",
                                                            type: "uint8",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownData2",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownTime1",
                                                            type: "uint64",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownByte1",
                                                            type: "uint8",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownData3",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword3",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownData4",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword3",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword4",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownVector1",
                                                            type: "floatvector4",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            name: "characterResources",
                            type: "array",
                            fields: [
                                { name: "resourceType", type: "uint32", defaultValue: 0 },
                                {
                                    name: "resourceData",
                                    type: "schema",
                                    fields: resourceEventDataSubSchema,
                                },
                            ],
                        },
                        {
                            name: "characterResourceChargers",
                            type: "array",
                            fields: [
                                { name: "resourceChargerId", type: "uint32", defaultValue: 0 },
                                {
                                    name: "resourceChargerData",
                                    type: "schema",
                                    fields: [
                                        {
                                            name: "resourceChargerId",
                                            type: "uint32",
                                            defaultValue: 0,
                                        },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "itemData",
                                            type: "schema",
                                            fields: [
                                                { name: "itemId", type: "uint32", defaultValue: 0 },
                                                { name: "itemClass", type: "uint32", defaultValue: 0 },
                                            ],
                                        },
                                    ],
                                },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "skillPointData",
                            type: "schema",
                            fields: [
                                { name: "skillPointsGranted", type: "uint64", defaultValue: 0 },
                                { name: "skillPointsTotal", type: "uint64", defaultValue: 0 },
                                { name: "skillPointsSpent", type: "uint64", defaultValue: 0 },
                                { name: "nextSkillPointPct", type: "double" },
                                { name: "unknownTime1", type: "uint64", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        {
                            name: "skills",
                            type: "array",
                            fields: [
                                { name: "skillLineId", type: "uint32", defaultValue: 0 },
                                { name: "skillId", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownBoolean8", type: "boolean", defaultValue: true },
                        { name: "unknownQword1", type: "uint64", defaultValue: 0 },
                        { name: "unknownDword38", type: "uint32", defaultValue: 0 },
                        { name: "unknownQword2", type: "uint64", defaultValue: 0 },
                        { name: "unknownQword3", type: "uint64", defaultValue: 0 },
                        { name: "unknownDword39", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword40", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean9", type: "boolean", defaultValue: true },
                    ],
                },
            ],
        },
    ],
    [
        "ClientIsReady",
        0x04,
        {
            fields: [],
        },
    ],
    [
        "ZoneDoneSendingInitialData",
        0x05,
        {
            fields: [],
        },
    ],
    [
        "Chat.Chat",
        0x060100,
        {
            fields: [
                { name: "unknown2", type: "uint16", defaultValue: 0 },
                { name: "channel", type: "uint16", defaultValue: 0 },
                { name: "characterId1", type: "uint64", defaultValue: "0" },
                { name: "characterId2", type: "uint64", defaultValue: "0" },
                { name: "unknown5_0", type: "uint32", defaultValue: 0 },
                { name: "unknown5_1", type: "uint32", defaultValue: 0 },
                { name: "unknown5_2", type: "uint32", defaultValue: 0 },
                { name: "characterName1", type: "string", defaultValue: "" },
                { name: "unknown5_3", type: "string", defaultValue: "" },
                { name: "unknown6_0", type: "uint32", defaultValue: 0 },
                { name: "unknown6_1", type: "uint32", defaultValue: 0 },
                { name: "unknown6_2", type: "uint32", defaultValue: 0 },
                { name: "characterName2", type: "string", defaultValue: "" },
                { name: "unknown6_3", type: "string", defaultValue: "" },
                { name: "message", type: "string", defaultValue: "" },
                { name: "position", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
                { name: "unknownGuid", type: "uint64", defaultValue: "0" },
                { name: "unknown13", type: "uint32", defaultValue: 0 },
                { name: "color1", type: "uint32", defaultValue: 0 },
                { name: "color2", type: "uint32", defaultValue: 0 },
                { name: "unknown15", type: "uint8", defaultValue: 0 },
                { name: "unknown16", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["Chat.EnterArea", 0x060200, { fields: [] }],
    ["Chat.DebugChat", 0x060300, { fields: [] }],
    ["Chat.FromStringId", 0x060400, { fields: [] }],
    ["Chat.TellEcho", 0x060500, { fields: [] }],
    [
        "Chat.ChatText",
        0x060600,
        {
            fields: [
                { name: "message", type: "string", defaultValue: "" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "color", type: "bytes", length: 4 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownByte3", type: "uint8", defaultValue: 0 },
                { name: "unknownByte4", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["ClientLogout", 0x07, { fields: [] }],
    ["TargetClientNotOnline", 0x08, { fields: [] }],
    ["Command.ShowDialog", 0x090100, { fields: [] }],
    ["AdminCommand.ShowDialog", 0x0a0100, { fields: [] }],
    ["Command.EndDialog", 0x090200, { fields: [] }],
    ["AdminCommand.EndDialog", 0x0a0200, { fields: [] }],
    ["Command.StartDialog", 0x090300, { fields: [] }],
    ["AdminCommand.StartDialog", 0x0a0300, { fields: [] }],
    ["Command.PlayerPlaySpeech", 0x090400, { fields: [] }],
    ["AdminCommand.PlayerPlaySpeech", 0x0a0400, { fields: [] }],
    ["Command.DialogResponse", 0x090500, { fields: [] }],
    ["AdminCommand.DialogResponse", 0x0a0500, { fields: [] }],
    ["Command.PlaySoundAtLocation", 0x090600, { fields: [] }],
    ["AdminCommand.PlaySoundAtLocation", 0x0a0600, { fields: [] }],
    [
        "Command.InteractRequest",
        0x090700,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    [
        "AdminCommand.InteractRequest",
        0x0a0700,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    [
        "Command.InteractCancel",
        0x090800,
        {
            fields: [],
        },
    ],
    [
        "AdminCommand.InteractCancel",
        0x0a0800,
        {
            fields: [],
        },
    ],
    [
        "Command.InteractionList",
        0x090900,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                {
                    name: "unknownArray1",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownBoolean2", type: "boolean", defaultValue: false },
                {
                    name: "unknownArray2",
                    type: "array",
                    fields: [
                        { name: "unknownString1", type: "uint32", defaultValue: 0 },
                        { name: "unknownFloat2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknownBoolean3", type: "boolean", defaultValue: false },
            ],
        },
    ],
    [
        "AdminCommand.InteractionList",
        0x0a0900,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                {
                    name: "unknownArray1",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownBoolean2", type: "boolean", defaultValue: false },
                {
                    name: "unknownArray2",
                    type: "array",
                    fields: [
                        { name: "unknownString1", type: "uint32", defaultValue: 0 },
                        { name: "unknownFloat2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknownBoolean3", type: "boolean", defaultValue: false },
            ],
        },
    ],
    [
        "Command.InteractionSelect",
        0x090a00,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "interactionId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "AdminCommand.InteractionSelect",
        0x0a0a00,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "interactionId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Command.InteractionStartWheel", 0x090b00, { fields: [] }],
    ["AdminCommand.InteractionStartWheel", 0x0a0b00, { fields: [] }],
    ["Command.StartFlashGame", 0x090c00, { fields: [] }],
    ["AdminCommand.StartFlashGame", 0x0a0c00, { fields: [] }],
    [
        "Command.SetProfile",
        0x090d00,
        {
            fields: [
                { name: "profileId", type: "uint32", defaultValue: 0 },
                { name: "tab", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "AdminCommand.SetProfile",
        0x0a0d00,
        {
            fields: [
                { name: "profileId", type: "uint32", defaultValue: 0 },
                { name: "tab", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Command.AddFriendRequest", 0x090e00, { fields: [] }],
    ["AdminCommand.AddFriendRequest", 0x0a0e00, { fields: [] }],
    ["Command.RemoveFriendRequest", 0x090f00, { fields: [] }],
    ["AdminCommand.RemoveFriendRequest", 0x0a0f00, { fields: [] }],
    ["Command.ConfirmFriendRequest", 0x091000, { fields: [] }],
    ["AdminCommand.ConfirmFriendRequest", 0x0a1000, { fields: [] }],
    ["Command.ConfirmFriendResponse", 0x091100, { fields: [] }],
    ["AdminCommand.ConfirmFriendResponse", 0x0a1100, { fields: [] }],
    ["Command.SetChatBubbleColor", 0x091200, { fields: [] }],
    ["AdminCommand.SetChatBubbleColor", 0x0a1200, { fields: [] }],
    [
        "Command.PlayerSelect",
        0x091300,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "guid", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "AdminCommand.PlayerSelect",
        0x0a1300,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "guid", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "Command.FreeInteractionNpc",
        0x091400,
        {
            fields: [],
        },
    ],
    [
        "AdminCommand.FreeInteractionNpc",
        0x0a1400,
        {
            fields: [],
        },
    ],
    ["Command.FriendsPositionRequest", 0x091500, { fields: [] }],
    ["AdminCommand.FriendsPositionRequest", 0x0a1500, { fields: [] }],
    ["Command.MoveAndInteract", 0x091600, { fields: [] }],
    ["AdminCommand.MoveAndInteract", 0x0a1600, { fields: [] }],
    ["Command.QuestAbandon", 0x091700, { fields: [] }],
    ["AdminCommand.QuestAbandon", 0x0a1700, { fields: [] }],
    ["Command.RecipeStart", 0x091800, { fields: [] }],
    ["AdminCommand.RecipeStart", 0x0a1800, { fields: [] }],
    ["Command.ShowRecipeWindow", 0x091900, { fields: [] }],
    ["AdminCommand.ShowRecipeWindow", 0x0a1900, { fields: [] }],
    ["Command.ActivateProfileFailed", 0x091a00, { fields: [] }],
    ["AdminCommand.ActivateProfileFailed", 0x0a1a00, { fields: [] }],
    ["Command.PlayDialogEffect", 0x091b00, { fields: [] }],
    ["AdminCommand.PlayDialogEffect", 0x0a1b00, { fields: [] }],
    ["Command.ForceClearDialog", 0x091c00, { fields: [] }],
    ["AdminCommand.ForceClearDialog", 0x0a1c00, { fields: [] }],
    ["Command.IgnoreRequest", 0x091d00, { fields: [] }],
    ["AdminCommand.IgnoreRequest", 0x0a1d00, { fields: [] }],
    ["Command.SetActiveVehicleGuid", 0x091e00, { fields: [] }],
    ["AdminCommand.SetActiveVehicleGuid", 0x0a1e00, { fields: [] }],
    ["Command.ChatChannelOn", 0x091f00, { fields: [] }],
    ["AdminCommand.ChatChannelOn", 0x0a1f00, { fields: [] }],
    ["Command.ChatChannelOff", 0x092000, { fields: [] }],
    ["AdminCommand.ChatChannelOff", 0x0a2000, { fields: [] }],
    ["Command.RequestPlayerPositions", 0x092100, { fields: [] }],
    ["AdminCommand.RequestPlayerPositions", 0x0a2100, { fields: [] }],
    ["Command.RequestPlayerPositionsReply", 0x092200, { fields: [] }],
    ["AdminCommand.RequestPlayerPositionsReply", 0x0a2200, { fields: [] }],
    ["Command.SetProfileByItemDefinitionId", 0x092300, { fields: [] }],
    ["AdminCommand.SetProfileByItemDefinitionId", 0x0a2300, { fields: [] }],
    ["Command.RequestRewardPreviewUpdate", 0x092400, { fields: [] }],
    ["AdminCommand.RequestRewardPreviewUpdate", 0x0a2400, { fields: [] }],
    ["Command.RequestRewardPreviewUpdateReply", 0x092500, { fields: [] }],
    ["AdminCommand.RequestRewardPreviewUpdateReply", 0x0a2500, { fields: [] }],
    ["Command.PlaySoundIdOnTarget", 0x092600, { fields: [] }],
    ["AdminCommand.PlaySoundIdOnTarget", 0x0a2600, { fields: [] }],
    ["Command.RequestPlayIntroEncounter", 0x092700, { fields: [] }],
    ["AdminCommand.RequestPlayIntroEncounter", 0x0a2700, { fields: [] }],
    ["Command.SpotPlayer", 0x092800, { fields: [] }],
    ["AdminCommand.SpotPlayer", 0x0a2800, { fields: [] }],
    ["Command.SpotPlayerReply", 0x092900, { fields: [] }],
    ["AdminCommand.SpotPlayerReply", 0x0a2900, { fields: [] }],
    ["Command.SpotPrimaryTarget", 0x092a00, { fields: [] }],
    ["AdminCommand.SpotPrimaryTarget", 0x0a2a00, { fields: [] }],
    [
        "Command.InteractionString",
        0x092b00,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "stringId", type: "uint32", defaultValue: 0 },
                { name: "unknown4", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "AdminCommand.InteractionString",
        0x0a2b00,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "stringId", type: "uint32", defaultValue: 0 },
                { name: "unknown4", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Command.GiveCurrency", 0x092c00, { fields: [] }],
    ["AdminCommand.GiveCurrency", 0x0a2c00, { fields: [] }],
    ["Command.HoldBreath", 0x092d00, { fields: [] }],
    ["AdminCommand.HoldBreath", 0x0a2d00, { fields: [] }],
    ["Command.ChargeCollision", 0x092e00, { fields: [] }],
    ["AdminCommand.ChargeCollision", 0x0a2e00, { fields: [] }],
    ["Command.DebrisLaunch", 0x092f00, { fields: [] }],
    ["AdminCommand.DebrisLaunch", 0x0a2f00, { fields: [] }],
    ["Command.Suicide", 0x093000, { fields: [] }],
    ["AdminCommand.Suicide", 0x0a3000, { fields: [] }],
    ["Command.RequestHelp", 0x093100, { fields: [] }],
    ["AdminCommand.RequestHelp", 0x0a3100, { fields: [] }],
    ["Command.OfferHelp", 0x093200, { fields: [] }],
    ["AdminCommand.OfferHelp", 0x0a3200, { fields: [] }],
    ["Command.Redeploy", 0x093300, { fields: [] }],
    ["AdminCommand.Redeploy", 0x0a3300, { fields: [] }],
    ["Command.PlayersInRadius", 0x093400, { fields: [] }],
    ["AdminCommand.PlayersInRadius", 0x0a3400, { fields: [] }],
    ["Command.AFK", 0x093500, { fields: [] }],
    ["AdminCommand.AFK", 0x0a3500, { fields: [] }],
    ["Command.ReportPlayerReply", 0x093600, { fields: [] }],
    ["AdminCommand.ReportPlayerReply", 0x0a3600, { fields: [] }],
    ["Command.ReportPlayerCheckNameRequest", 0x093700, { fields: [] }],
    ["AdminCommand.ReportPlayerCheckNameRequest", 0x0a3700, { fields: [] }],
    ["Command.ReportPlayerCheckNameReply", 0x093800, { fields: [] }],
    ["AdminCommand.ReportPlayerCheckNameReply", 0x0a3800, { fields: [] }],
    ["Command.ReportRendererDump", 0x093900, { fields: [] }],
    ["AdminCommand.ReportRendererDump", 0x0a3900, { fields: [] }],
    ["Command.ChangeName", 0x093a00, { fields: [] }],
    ["AdminCommand.ChangeName", 0x0a3a00, { fields: [] }],
    ["Command.NameValidation", 0x093b00, { fields: [] }],
    ["AdminCommand.NameValidation", 0x0a3b00, { fields: [] }],
    ["Command.PlayerFileDistribution", 0x093c00, { fields: [] }],
    ["AdminCommand.PlayerFileDistribution", 0x0a3c00, { fields: [] }],
    ["Command.ZoneFileDistribution", 0x093d00, { fields: [] }],
    ["AdminCommand.ZoneFileDistribution", 0x0a3d00, { fields: [] }],
    [
        "Command.AddWorldCommand",
        0x093e00,
        {
            fields: [{ name: "command", type: "string", defaultValue: "" }],
        },
    ],
    [
        "AdminCommand.AddWorldCommand",
        0x0a3e00,
        {
            fields: [{ name: "command", type: "string", defaultValue: "" }],
        },
    ],
    [
        "Command.AddZoneCommand",
        0x093f00,
        {
            fields: [{ name: "command", type: "string", defaultValue: "" }],
        },
    ],
    [
        "AdminCommand.AddZoneCommand",
        0x0a3f00,
        {
            fields: [{ name: "command", type: "string", defaultValue: "" }],
        },
    ],
    [
        "Command.ExecuteCommand",
        0x094000,
        {
            fields: [
                { name: "commandHash", type: "uint32", defaultValue: 0 },
                { name: "arguments", type: "string", defaultValue: "" },
            ],
        },
    ],
    [
        "AdminCommand.ExecuteCommand",
        0x0a4000,
        {
            fields: [
                { name: "commandHash", type: "uint32", defaultValue: 0 },
                { name: "arguments", type: "string", defaultValue: "" },
            ],
        },
    ],
    [
        "Command.ZoneExecuteCommand",
        0x094100,
        {
            fields: [
                { name: "commandHash", type: "uint32", defaultValue: 0 },
                { name: "arguments", type: "string", defaultValue: "" },
            ],
        },
    ],
    [
        "AdminCommand.ZoneExecuteCommand",
        0x0a4100,
        {
            fields: [
                { name: "commandHash", type: "uint32", defaultValue: 0 },
                { name: "arguments", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["Command.RequestStripEffect", 0x094200, { fields: [] }],
    ["AdminCommand.RequestStripEffect", 0x0a4200, { fields: [] }],
    ["Command.ItemDefinitionRequest", 0x094300, { fields: [] }],
    ["AdminCommand.ItemDefinitionRequest", 0x0a4300, { fields: [] }],
    ["Command.ItemDefinitionReply", 0x094400, { fields: [] }],
    ["AdminCommand.ItemDefinitionReply", 0x0a4400, { fields: [] }],
    ["Command.ItemDefinitions", 0x094500, { fields: [] }],
    ["AdminCommand.ItemDefinitions", 0x0a4500, { fields: [] }],
    [
        "Command.EnableCompositeEffects",
        0x094600,
        {
            fields: [{ name: "enabled", type: "boolean", defaultValue: false }],
        },
    ],
    [
        "AdminCommand.EnableCompositeEffects",
        0x0a4600,
        {
            fields: [{ name: "enabled", type: "boolean", defaultValue: false }],
        },
    ],
    ["Command.StartRentalUpsell", 0x094700, { fields: [] }],
    ["AdminCommand.StartRentalUpsell", 0x0a4700, { fields: [] }],
    ["Command.SafeEject", 0x094800, { fields: [] }],
    ["AdminCommand.SafeEject", 0x0a4800, { fields: [] }],
    ["Command.ValidateDataForZoneOwnedTiles", 0x096c04, { fields: [] }],
    ["AdminCommand.ValidateDataForZoneOwnedTiles", 0x0a6c04, { fields: [] }],
    [
        "Command.RequestWeaponFireStateUpdate",
        0x094900,
        {
            fields: [{ name: "characterId", type: "uint64", defaultValue: "0" }],
        },
    ],
    [
        "AdminCommand.RequestWeaponFireStateUpdate",
        0x0a4900,
        {
            fields: [{ name: "characterId", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["Command.SetInWater", 0x094a00, { fields: [] }],
    ["AdminCommand.SetInWater", 0x0a4a00, { fields: [] }],
    ["Command.ClearInWater", 0x094b00, { fields: [] }],
    ["AdminCommand.ClearInWater", 0x0a4b00, { fields: [] }],
    ["Command.StartLogoutRequest", 0x094c00, { fields: [] }],
    ["AdminCommand.StartLogoutRequest", 0x0a4c00, { fields: [] }],
    ["Command.Delivery", 0x094d00, { fields: [] }],
    ["AdminCommand.Delivery", 0x0a4d00, { fields: [] }],
    ["Command.DeliveryDisplayInfo", 0x094e00, { fields: [] }],
    ["AdminCommand.DeliveryDisplayInfo", 0x0a4e00, { fields: [] }],
    ["Command.DeliveryManagerStatus", 0x094f00, { fields: [] }],
    ["AdminCommand.DeliveryManagerStatus", 0x0a4f00, { fields: [] }],
    ["Command.DeliveryManagerShowNotification", 0x095000, { fields: [] }],
    ["AdminCommand.DeliveryManagerShowNotification", 0x0a5000, { fields: [] }],
    ["Command.AddItem", 0x09ea03, { fields: [] }],
    ["AdminCommand.AddItem", 0x0aea03, { fields: [] }],
    ["Command.DeleteItem", 0x09eb03, { fields: [] }],
    ["AdminCommand.DeleteItem", 0x0aeb03, { fields: [] }],
    ["Command.AbilityReply", 0x09ec03, { fields: [] }],
    ["AdminCommand.AbilityReply", 0x0aec03, { fields: [] }],
    ["Command.AbilityList", 0x09ed03, { fields: [] }],
    ["AdminCommand.AbilityList", 0x0aed03, { fields: [] }],
    ["Command.AbilityAdd", 0x09ee03, { fields: [] }],
    ["AdminCommand.AbilityAdd", 0x0aee03, { fields: [] }],
    ["Command.ServerInformation", 0x09ef03, { fields: [] }],
    ["AdminCommand.ServerInformation", 0x0aef03, { fields: [] }],
    ["Command.SpawnNpcRequest", 0x09f003, { fields: [] }],
    ["AdminCommand.SpawnNpcRequest", 0x0af003, { fields: [] }],
    ["Command.NpcSpawn", 0x09f103, { fields: [] }],
    ["AdminCommand.NpcSpawn", 0x0af103, { fields: [] }],
    ["Command.NpcList", 0x09f203, { fields: [] }],
    ["AdminCommand.NpcList", 0x0af203, { fields: [] }],
    ["Command.NpcDisableSpawners", 0x09f303, { fields: [] }],
    ["AdminCommand.NpcDisableSpawners", 0x0af303, { fields: [] }],
    ["Command.NpcDespawn", 0x09f403, { fields: [] }],
    ["AdminCommand.NpcDespawn", 0x0af403, { fields: [] }],
    ["Command.NpcCreateSpawn", 0x09f503, { fields: [] }],
    ["AdminCommand.NpcCreateSpawn", 0x0af503, { fields: [] }],
    ["Command.NpcInfoRequest", 0x09f603, { fields: [] }],
    ["AdminCommand.NpcInfoRequest", 0x0af603, { fields: [] }],
    ["Command.ZonePacketLogging", 0x09f703, { fields: [] }],
    ["AdminCommand.ZonePacketLogging", 0x0af703, { fields: [] }],
    ["Command.ZoneListRequest", 0x09f803, { fields: [] }],
    ["AdminCommand.ZoneListRequest", 0x0af803, { fields: [] }],
    ["Command.ZoneListReply", 0x09f903, { fields: [] }],
    ["AdminCommand.ZoneListReply", 0x0af903, { fields: [] }],
    ["Command.TeleportToLocation", 0x09fa03, { fields: [] }],
    ["AdminCommand.TeleportToLocation", 0x0afa03, { fields: [] }],
    ["Command.TeleportToLocationEx", 0x09fb03, { fields: [] }],
    ["AdminCommand.TeleportToLocationEx", 0x0afb03, { fields: [] }],
    ["Command.TeleportManagedToLocation", 0x09fc03, { fields: [] }],
    ["AdminCommand.TeleportManagedToLocation", 0x0afc03, { fields: [] }],
    ["Command.CollectionStart", 0x09fd03, { fields: [] }],
    ["AdminCommand.CollectionStart", 0x0afd03, { fields: [] }],
    ["Command.CollectionClear", 0x09fe03, { fields: [] }],
    ["AdminCommand.CollectionClear", 0x0afe03, { fields: [] }],
    ["Command.CollectionRemove", 0x09ff03, { fields: [] }],
    ["AdminCommand.CollectionRemove", 0x0aff03, { fields: [] }],
    ["Command.CollectionAddEntry", 0x090004, { fields: [] }],
    ["AdminCommand.CollectionAddEntry", 0x0a0004, { fields: [] }],
    ["Command.CollectionRemoveEntry", 0x090104, { fields: [] }],
    ["AdminCommand.CollectionRemoveEntry", 0x0a0104, { fields: [] }],
    ["Command.CollectionRefresh", 0x090204, { fields: [] }],
    ["AdminCommand.CollectionRefresh", 0x0a0204, { fields: [] }],
    ["Command.CollectionFill", 0x090304, { fields: [] }],
    ["AdminCommand.CollectionFill", 0x0a0304, { fields: [] }],
    ["Command.ReloadData", 0x090404, { fields: [] }],
    ["AdminCommand.ReloadData", 0x0a0404, { fields: [] }],
    ["Command.OnlineStatusRequest", 0x090504, { fields: [] }],
    ["AdminCommand.OnlineStatusRequest", 0x0a0504, { fields: [] }],
    ["Command.OnlineStatusReply", 0x090604, { fields: [] }],
    ["AdminCommand.OnlineStatusReply", 0x0a0604, { fields: [] }],
    ["Command.MovePlayerToWorldLocation", 0x090704, { fields: [] }],
    ["AdminCommand.MovePlayerToWorldLocation", 0x0a0704, { fields: [] }],
    ["Command.MovePlayerToTargetPlayer", 0x090804, { fields: [] }],
    ["AdminCommand.MovePlayerToTargetPlayer", 0x0a0804, { fields: [] }],
    ["Command.LaunchAbilityId", 0x090904, { fields: [] }],
    ["AdminCommand.LaunchAbilityId", 0x0a0904, { fields: [] }],
    ["Command.Kill", 0x090a04, { fields: [] }],
    ["AdminCommand.Kill", 0x0a0a04, { fields: [] }],
    ["Command.FindEnemy", 0x090b04, { fields: [] }],
    ["AdminCommand.FindEnemy", 0x0a0b04, { fields: [] }],
    ["Command.FindEnemyReply", 0x090c04, { fields: [] }],
    ["AdminCommand.FindEnemyReply", 0x0a0c04, { fields: [] }],
    ["Command.FollowPlayer", 0x090d04, { fields: [] }],
    ["AdminCommand.FollowPlayer", 0x0a0d04, { fields: [] }],
    ["Command.SetClientDebugFlag", 0x090e04, { fields: [] }],
    ["AdminCommand.SetClientDebugFlag", 0x0a0e04, { fields: [] }],
    ["Command.RunZoneScript", 0x090f04, { fields: [] }],
    ["AdminCommand.RunZoneScript", 0x0a0f04, { fields: [] }],
    ["Command.RequestAggroDist", 0x091004, { fields: [] }],
    ["AdminCommand.RequestAggroDist", 0x0a1004, { fields: [] }],
    ["Command.AggroDist", 0x091104, { fields: [] }],
    ["AdminCommand.AggroDist", 0x0a1104, { fields: [] }],
    ["Command.TestRequirement", 0x091204, { fields: [] }],
    ["AdminCommand.TestRequirement", 0x0a1204, { fields: [] }],
    ["Command.UITest", 0x091304, { fields: [] }],
    ["AdminCommand.UITest", 0x0a1304, { fields: [] }],
    ["Command.EncounterComplete", 0x091404, { fields: [] }],
    ["AdminCommand.EncounterComplete", 0x0a1404, { fields: [] }],
    ["Command.AddRewardBonus", 0x091504, { fields: [] }],
    ["AdminCommand.AddRewardBonus", 0x0a1504, { fields: [] }],
    ["Command.SetClientBehaviorFlag", 0x091604, { fields: [] }],
    ["AdminCommand.SetClientBehaviorFlag", 0x0a1604, { fields: [] }],
    ["Command.SetVipRank", 0x091704, { fields: [] }],
    ["AdminCommand.SetVipRank", 0x0a1704, { fields: [] }],
    ["Command.ToggleDebugNpc", 0x091804, { fields: [] }],
    ["AdminCommand.ToggleDebugNpc", 0x0a1804, { fields: [] }],
    ["Command.QuestStart", 0x091904, { fields: [] }],
    ["AdminCommand.QuestStart", 0x0a1904, { fields: [] }],
    ["Command.SummonRequest", 0x091a04, { fields: [] }],
    ["AdminCommand.SummonRequest", 0x0a1a04, { fields: [] }],
    ["Command.QuestList", 0x091b04, { fields: [] }],
    ["AdminCommand.QuestList", 0x0a1b04, { fields: [] }],
    ["Command.EncounterStart", 0x091c04, { fields: [] }],
    ["AdminCommand.EncounterStart", 0x0a1c04, { fields: [] }],
    ["Command.RewardSetGive", 0x091d04, { fields: [] }],
    ["AdminCommand.RewardSetGive", 0x0a1d04, { fields: [] }],
    ["Command.RewardSetList", 0x091e04, { fields: [] }],
    ["AdminCommand.RewardSetList", 0x0a1e04, { fields: [] }],
    ["Command.RewardSetFind", 0x091f04, { fields: [] }],
    ["AdminCommand.RewardSetFind", 0x0a1f04, { fields: [] }],
    ["Command.QuestComplete", 0x092004, { fields: [] }],
    ["AdminCommand.QuestComplete", 0x0a2004, { fields: [] }],
    ["Command.QuestStatus", 0x092104, { fields: [] }],
    ["AdminCommand.QuestStatus", 0x0a2104, { fields: [] }],
    ["Command.CoinsSet", 0x092204, { fields: [] }],
    ["AdminCommand.CoinsSet", 0x0a2204, { fields: [] }],
    ["Command.CoinsAdd", 0x092304, { fields: [] }],
    ["AdminCommand.CoinsAdd", 0x0a2304, { fields: [] }],
    ["Command.CoinsGet", 0x092404, { fields: [] }],
    ["AdminCommand.CoinsGet", 0x0a2404, { fields: [] }],
    ["Command.AddCurrency", 0x092504, { fields: [] }],
    ["AdminCommand.AddCurrency", 0x0a2504, { fields: [] }],
    ["Command.SetCurrency", 0x092604, { fields: [] }],
    ["AdminCommand.SetCurrency", 0x0a2604, { fields: [] }],
    ["Command.ClearCurrency", 0x092704, { fields: [] }],
    ["AdminCommand.ClearCurrency", 0x0a2704, { fields: [] }],
    ["Command.RewardCurrency", 0x092804, { fields: [] }],
    ["AdminCommand.RewardCurrency", 0x0a2804, { fields: [] }],
    ["Command.ListCurrencyRequest", 0x092904, { fields: [] }],
    ["AdminCommand.ListCurrencyRequest", 0x0a2904, { fields: [] }],
    ["Command.ListCurrencyReply", 0x092a04, { fields: [] }],
    ["AdminCommand.ListCurrencyReply", 0x0a2a04, { fields: [] }],
    ["Command.RewardSetGiveRadius", 0x092b04, { fields: [] }],
    ["AdminCommand.RewardSetGiveRadius", 0x0a2b04, { fields: [] }],
    ["Command.InGamePurchaseRequest", 0x092c04, { fields: [] }],
    ["AdminCommand.InGamePurchaseRequest", 0x0a2c04, { fields: [] }],
    ["Command.InGamePurchaseReply", 0x092d04, { fields: [] }],
    ["AdminCommand.InGamePurchaseReply", 0x0a2d04, { fields: [] }],
    ["Command.TestNpcRelevance", 0x092e04, { fields: [] }],
    ["AdminCommand.TestNpcRelevance", 0x0a2e04, { fields: [] }],
    ["Command.GameTime", 0x092f04, { fields: [] }],
    ["AdminCommand.GameTime", 0x0a2f04, { fields: [] }],
    ["Command.ClientTime", 0x093004, { fields: [] }],
    ["AdminCommand.ClientTime", 0x0a3004, { fields: [] }],
    ["Command.QuestObjectiveComplete", 0x093104, { fields: [] }],
    ["AdminCommand.QuestObjectiveComplete", 0x0a3104, { fields: [] }],
    ["Command.QuestObjectiveIncrement", 0x093204, { fields: [] }],
    ["AdminCommand.QuestObjectiveIncrement", 0x0a3204, { fields: [] }],
    ["Command.EncounterStatus", 0x093304, { fields: [] }],
    ["AdminCommand.EncounterStatus", 0x0a3304, { fields: [] }],
    ["Command.GotoRequest", 0x093404, { fields: [] }],
    ["AdminCommand.GotoRequest", 0x0a3404, { fields: [] }],
    ["Command.GotoReply", 0x093504, { fields: [] }],
    ["AdminCommand.GotoReply", 0x0a3504, { fields: [] }],
    ["Command.GotoWapointRequest", 0x093604, { fields: [] }],
    ["AdminCommand.GotoWapointRequest", 0x0a3604, { fields: [] }],
    ["Command.ServerVersion", 0x093704, { fields: [] }],
    ["AdminCommand.ServerVersion", 0x0a3704, { fields: [] }],
    ["Command.ServerUptime", 0x093804, { fields: [] }],
    ["AdminCommand.ServerUptime", 0x0a3804, { fields: [] }],
    ["Command.DeleteItemById", 0x093904, { fields: [] }],
    ["AdminCommand.DeleteItemById", 0x0a3904, { fields: [] }],
    ["Command.GetItemList", 0x093a04, { fields: [] }],
    ["AdminCommand.GetItemList", 0x0a3a04, { fields: [] }],
    ["Command.GetItemListReply", 0x093b04, { fields: [] }],
    ["AdminCommand.GetItemListReply", 0x0a3b04, { fields: [] }],
    ["Command.QuestHistory", 0x093c04, { fields: [] }],
    ["AdminCommand.QuestHistory", 0x0a3c04, { fields: [] }],
    ["Command.QuestHistoryClear", 0x093d04, { fields: [] }],
    ["AdminCommand.QuestHistoryClear", 0x0a3d04, { fields: [] }],
    ["Command.TradeStatus", 0x093e04, { fields: [] }],
    ["AdminCommand.TradeStatus", 0x0a3e04, { fields: [] }],
    ["Command.PathDataRequest", 0x093f04, { fields: [] }],
    ["AdminCommand.PathDataRequest", 0x0a3f04, { fields: [] }],
    ["Command.SummonReply", 0x094004, { fields: [] }],
    ["AdminCommand.SummonReply", 0x0a4004, { fields: [] }],
    ["Command.Broadcast", 0x094104, { fields: [] }],
    ["AdminCommand.Broadcast", 0x0a4104, { fields: [] }],
    ["Command.BroadcastZone", 0x094204, { fields: [] }],
    ["AdminCommand.BroadcastZone", 0x0a4204, { fields: [] }],
    ["Command.BroadcastWorld", 0x094304, { fields: [] }],
    ["AdminCommand.BroadcastWorld", 0x0a4304, { fields: [] }],
    ["Command.ListPets", 0x094404, { fields: [] }],
    ["AdminCommand.ListPets", 0x0a4404, { fields: [] }],
    ["Command.PetSetUtility", 0x094504, { fields: [] }],
    ["AdminCommand.PetSetUtility", 0x0a4504, { fields: [] }],
    ["Command.PetTrick", 0x094604, { fields: [] }],
    ["AdminCommand.PetTrick", 0x0a4604, { fields: [] }],
    ["Command.RecipeAction", 0x094704, { fields: [] }],
    ["AdminCommand.RecipeAction", 0x0a4704, { fields: [] }],
    ["Command.WorldKick", 0x094804, { fields: [] }],
    ["AdminCommand.WorldKick", 0x0a4804, { fields: [] }],
    ["Command.EncounterRunTimerDisable", 0x094904, { fields: [] }],
    ["AdminCommand.EncounterRunTimerDisable", 0x0a4904, { fields: [] }],
    ["Command.ReloadPermissions", 0x094a04, { fields: [] }],
    ["AdminCommand.ReloadPermissions", 0x0a4a04, { fields: [] }],
    ["Command.CharacterFlags", 0x094b04, { fields: [] }],
    ["AdminCommand.CharacterFlags", 0x0a4b04, { fields: [] }],
    ["Command.SetEncounterPartySizeOverride", 0x094c04, { fields: [] }],
    ["AdminCommand.SetEncounterPartySizeOverride", 0x0a4c04, { fields: [] }],
    ["Command.BuildTime", 0x094d04, { fields: [] }],
    ["AdminCommand.BuildTime", 0x0a4d04, { fields: [] }],
    ["Command.SelectiveSpawnEnable", 0x094e04, { fields: [] }],
    ["AdminCommand.SelectiveSpawnEnable", 0x0a4e04, { fields: [] }],
    ["Command.SelectiveSpawnAdd", 0x094f04, { fields: [] }],
    ["AdminCommand.SelectiveSpawnAdd", 0x0a4f04, { fields: [] }],
    ["Command.SelectiveSpawnAddById", 0x095004, { fields: [] }],
    ["AdminCommand.SelectiveSpawnAddById", 0x0a5004, { fields: [] }],
    ["Command.SelectiveSpawnClear", 0x095104, { fields: [] }],
    ["AdminCommand.SelectiveSpawnClear", 0x0a5104, { fields: [] }],
    ["Command.BecomeEnforcer", 0x095204, { fields: [] }],
    ["AdminCommand.BecomeEnforcer", 0x0a5204, { fields: [] }],
    ["Command.BecomeReferee", 0x095304, { fields: [] }],
    ["AdminCommand.BecomeReferee", 0x0a5304, { fields: [] }],
    ["Command.Profiler", 0x095404, { fields: [] }],
    ["AdminCommand.Profiler", 0x0a5404, { fields: [] }],
    ["Command.WorldKickPending", 0x095504, { fields: [] }],
    ["AdminCommand.WorldKickPending", 0x0a5504, { fields: [] }],
    ["Command.ActivateMembership", 0x095604, { fields: [] }],
    ["AdminCommand.ActivateMembership", 0x0a5604, { fields: [] }],
    ["Command.JoinLobby", 0x095704, { fields: [] }],
    ["AdminCommand.JoinLobby", 0x0a5704, { fields: [] }],
    ["Command.LeaveLobby", 0x095804, { fields: [] }],
    ["AdminCommand.LeaveLobby", 0x0a5804, { fields: [] }],
    ["Command.SetMOTD", 0x095904, { fields: [] }],
    ["AdminCommand.SetMOTD", 0x0a5904, { fields: [] }],
    ["Command.Snoop", 0x095a04, { fields: [] }],
    ["AdminCommand.Snoop", 0x0a5a04, { fields: [] }],
    ["Command.JoinScheduledActivityRequest", 0x095b04, { fields: [] }],
    ["AdminCommand.JoinScheduledActivityRequest", 0x0a5b04, { fields: [] }],
    ["Command.JoinScheduledActivityReply", 0x095c04, { fields: [] }],
    ["AdminCommand.JoinScheduledActivityReply", 0x0a5c04, { fields: [] }],
    ["Command.BecomeAmbassador", 0x095d04, { fields: [] }],
    ["AdminCommand.BecomeAmbassador", 0x0a5d04, { fields: [] }],
    ["Command.CollectionsShow", 0x095e04, { fields: [] }],
    ["AdminCommand.CollectionsShow", 0x0a5e04, { fields: [] }],
    ["Command.GetZoneDrawData", 0x095f04, { fields: [] }],
    ["AdminCommand.GetZoneDrawData", 0x0a5f04, { fields: [] }],
    ["Command.ZoneDrawData", 0x096004, { fields: [] }],
    ["AdminCommand.ZoneDrawData", 0x0a6004, { fields: [] }],
    ["Command.QuestAbandon", 0x096104, { fields: [] }],
    ["AdminCommand.QuestAbandon", 0x0a6104, { fields: [] }],
    ["Command.SetVehicleDefault", 0x096204, { fields: [] }],
    ["AdminCommand.SetVehicleDefault", 0x0a6204, { fields: [] }],
    ["Command.Freeze", 0x096304, { fields: [] }],
    ["AdminCommand.Freeze", 0x0a6304, { fields: [] }],
    ["Command.ObjectiveAction", 0x096404, { fields: [] }],
    ["AdminCommand.ObjectiveAction", 0x0a6404, { fields: [] }],
    ["Command.EquipAdd", 0x096504, { fields: [] }],
    ["AdminCommand.EquipAdd", 0x0a6504, { fields: [] }],
    ["Command.Info", 0x096604, { fields: [] }],
    ["AdminCommand.Info", 0x0a6604, { fields: [] }],
    ["Command.Silence", 0x096704, { fields: [] }],
    ["AdminCommand.Silence", 0x0a6704, { fields: [] }],
    ["Command.SpawnerStatus", 0x096804, { fields: [] }],
    ["AdminCommand.SpawnerStatus", 0x0a6804, { fields: [] }],
    ["Command.Behavior", 0x096904, { fields: [] }],
    ["AdminCommand.Behavior", 0x0a6904, { fields: [] }],
    ["Command.DebugFirstTimeEvents", 0x096a04, { fields: [] }],
    ["AdminCommand.DebugFirstTimeEvents", 0x0a6a04, { fields: [] }],
    ["Command.SetWorldWebEventAggregationPeriod", 0x096b04, { fields: [] }],
    ["AdminCommand.SetWorldWebEventAggregationPeriod", 0x0a6b04, { fields: [] }],
    ["Command.GivePet", 0x096d04, { fields: [] }],
    ["AdminCommand.GivePet", 0x0a6d04, { fields: [] }],
    ["Command.NpcLocationRequest", 0x096e04, { fields: [] }],
    ["AdminCommand.NpcLocationRequest", 0x0a6e04, { fields: [] }],
    ["Command.BroadcastUniverse", 0x096f04, { fields: [] }],
    ["AdminCommand.BroadcastUniverse", 0x0a6f04, { fields: [] }],
    ["Command.TrackedEventLogToFile", 0x097004, { fields: [] }],
    ["AdminCommand.TrackedEventLogToFile", 0x0a7004, { fields: [] }],
    ["Command.TrackedEventEnable", 0x097104, { fields: [] }],
    ["AdminCommand.TrackedEventEnable", 0x0a7104, { fields: [] }],
    ["Command.TrackedEventEnableAll", 0x097204, { fields: [] }],
    ["AdminCommand.TrackedEventEnableAll", 0x0a7204, { fields: [] }],
    ["Command.Event", 0x097304, { fields: [] }],
    ["AdminCommand.Event", 0x0a7304, { fields: [] }],
    ["Command.PerformAction", 0x097404, { fields: [] }],
    ["AdminCommand.PerformAction", 0x0a7404, { fields: [] }],
    ["Command.CountrySet", 0x097504, { fields: [] }],
    ["AdminCommand.CountrySet", 0x0a7504, { fields: [] }],
    ["Command.TrackedEventReloadConfig", 0x097604, { fields: [] }],
    ["AdminCommand.TrackedEventReloadConfig", 0x0a7604, { fields: [] }],
    ["Command.SummonNPC", 0x097704, { fields: [] }],
    ["AdminCommand.SummonNPC", 0x0a7704, { fields: [] }],
    ["Command.AchievementComplete", 0x097804, { fields: [] }],
    ["AdminCommand.AchievementComplete", 0x0a7804, { fields: [] }],
    ["Command.AchievementList", 0x097904, { fields: [] }],
    ["AdminCommand.AchievementList", 0x0a7904, { fields: [] }],
    ["Command.AchievementStatus", 0x097a04, { fields: [] }],
    ["AdminCommand.AchievementStatus", 0x0a7a04, { fields: [] }],
    ["Command.AchievementObjectiveComplete", 0x097b04, { fields: [] }],
    ["AdminCommand.AchievementObjectiveComplete", 0x0a7b04, { fields: [] }],
    ["Command.AchievementObjectiveIncrement", 0x097c04, { fields: [] }],
    ["AdminCommand.AchievementObjectiveIncrement", 0x0a7c04, { fields: [] }],
    ["Command.AchievementEnable", 0x097d04, { fields: [] }],
    ["AdminCommand.AchievementEnable", 0x0a7d04, { fields: [] }],
    ["Command.AchievementReset", 0x097e04, { fields: [] }],
    ["AdminCommand.AchievementReset", 0x0a7e04, { fields: [] }],
    ["Command.SetAffiliate", 0x097f04, { fields: [] }],
    ["AdminCommand.SetAffiliate", 0x0a7f04, { fields: [] }],
    ["Command.HousingInstanceEdit", 0x098004, { fields: [] }],
    ["AdminCommand.HousingInstanceEdit", 0x0a8004, { fields: [] }],
    ["Command.WorldRequest", 0x098104, { fields: [] }],
    ["AdminCommand.WorldRequest", 0x0a8104, { fields: [] }],
    ["Command.EnableNpcRelevanceBypass", 0x098204, { fields: [] }],
    ["AdminCommand.EnableNpcRelevanceBypass", 0x0a8204, { fields: [] }],
    ["Command.GrantPromotionalBundle", 0x098304, { fields: [] }],
    ["AdminCommand.GrantPromotionalBundle", 0x0a8304, { fields: [] }],
    ["Command.ResetItemCooldowns", 0x098404, { fields: [] }],
    ["AdminCommand.ResetItemCooldowns", 0x0a8404, { fields: [] }],
    ["Command.MountAdd", 0x098504, { fields: [] }],
    ["AdminCommand.MountAdd", 0x0a8504, { fields: [] }],
    ["Command.MountDelete", 0x098604, { fields: [] }],
    ["AdminCommand.MountDelete", 0x0a8604, { fields: [] }],
    ["Command.MountList", 0x098704, { fields: [] }],
    ["AdminCommand.MountList", 0x0a8704, { fields: [] }],
    ["Command.GetItemInfo", 0x098804, { fields: [] }],
    ["AdminCommand.GetItemInfo", 0x0a8804, { fields: [] }],
    ["Command.RequestZoneComprehensiveDataDump", 0x098904, { fields: [] }],
    ["AdminCommand.RequestZoneComprehensiveDataDump", 0x0a8904, { fields: [] }],
    ["Command.RequestZoneComprehensiveDataDumpReply", 0x098a04, { fields: [] }],
    [
        "AdminCommand.RequestZoneComprehensiveDataDumpReply",
        0x0a8a04,
        { fields: [] },
    ],
    ["Command.NpcDamage", 0x098b04, { fields: [] }],
    ["AdminCommand.NpcDamage", 0x0a8b04, { fields: [] }],
    ["Command.HousingAddTrophy", 0x098c04, { fields: [] }],
    ["AdminCommand.HousingAddTrophy", 0x0a8c04, { fields: [] }],
    ["Command.TargetOfTarget", 0x098d04, { fields: [] }],
    ["AdminCommand.TargetOfTarget", 0x0a8d04, { fields: [] }],
    ["Command.AddAbilityEntry", 0x098e04, { fields: [] }],
    ["AdminCommand.AddAbilityEntry", 0x0a8e04, { fields: [] }],
    ["Command.RemoveAbilityEntry", 0x098f04, { fields: [] }],
    ["AdminCommand.RemoveAbilityEntry", 0x0a8f04, { fields: [] }],
    ["Command.PhaseList", 0x099004, { fields: [] }],
    ["AdminCommand.PhaseList", 0x0a9004, { fields: [] }],
    ["Command.PhaseAdd", 0x099104, { fields: [] }],
    ["AdminCommand.PhaseAdd", 0x0a9104, { fields: [] }],
    ["Command.PhaseRemove", 0x099204, { fields: [] }],
    ["AdminCommand.PhaseRemove", 0x0a9204, { fields: [] }],
    ["Command.AdventureAdd", 0x099304, { fields: [] }],
    ["AdminCommand.AdventureAdd", 0x0a9304, { fields: [] }],
    ["Command.AdventureSetPhase", 0x099404, { fields: [] }],
    ["AdminCommand.AdventureSetPhase", 0x0a9404, { fields: [] }],
    ["Command.SetFactionId", 0x099504, { fields: [] }],
    ["AdminCommand.SetFactionId", 0x0a9504, { fields: [] }],
    ["Command.FacilitySpawnSetCollisionState", 0x099604, { fields: [] }],
    ["AdminCommand.FacilitySpawnSetCollisionState", 0x0a9604, { fields: [] }],
    ["Command.SkillBase", 0x099704, { fields: [] }],
    ["AdminCommand.SkillBase", 0x0a9704, { fields: [] }],
    ["Command.VehicleBase", 0x099804, { fields: [] }],
    ["AdminCommand.VehicleBase", 0x0a9804, { fields: [] }],
    [
        "Command.SpawnVehicle",
        0x099904,
        {
            fields: [
                { name: "vehicleId", type: "uint32", defaultValue: 0 },
                { name: "factionId", type: "uint8", defaultValue: 0 },
                { name: "position", type: "floatvector3" },
                { name: "heading", type: "float", defaultValue: 0.0 },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "autoMount", type: "boolean", defaultValue: false },
            ],
        },
    ],
    [
        "AdminCommand.SpawnVehicle",
        0x0a9904,
        {
            fields: [
                { name: "vehicleId", type: "uint32", defaultValue: 0 },
                { name: "factionId", type: "uint8", defaultValue: 0 },
                { name: "position", type: "floatvector3" },
                { name: "heading", type: "float", defaultValue: 0.0 },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "autoMount", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["Command.SpawnVehicleReply", 0x099a04, { fields: [] }],
    ["AdminCommand.SpawnVehicleReply", 0x0a9a04, { fields: [] }],
    ["Command.DespawnVehicle", 0x099b04, { fields: [] }],
    ["AdminCommand.DespawnVehicle", 0x0a9b04, { fields: [] }],
    ["Command.WeaponStat", 0x099c04, { fields: [] }],
    ["AdminCommand.WeaponStat", 0x0a9c04, { fields: [] }],
    ["Command.GuildBase", 0x099d04, { fields: [] }],
    ["AdminCommand.GuildBase", 0x0a9d04, { fields: [] }],
    ["Command.VisualizePhysics", 0x099e04, { fields: [] }],
    ["AdminCommand.VisualizePhysics", 0x0a9e04, { fields: [] }],
    ["Command.PlayerHealthSetRequest", 0x099f04, { fields: [] }],
    ["AdminCommand.PlayerHealthSetRequest", 0x0a9f04, { fields: [] }],
    ["Command.PlayerForceRespawnRequest", 0x09a004, { fields: [] }],
    ["AdminCommand.PlayerForceRespawnRequest", 0x0aa004, { fields: [] }],
    ["Command.ResourceRequest", 0x09a104, { fields: [] }],
    ["AdminCommand.ResourceRequest", 0x0aa104, { fields: [] }],
    ["Command.ZoneDebugMessage", 0x09a204, { fields: [] }],
    ["AdminCommand.ZoneDebugMessage", 0x0aa204, { fields: [] }],
    ["Command.VerifyAdminTarget", 0x09a304, { fields: [] }],
    ["AdminCommand.VerifyAdminTarget", 0x0aa304, { fields: [] }],
    ["Command.SetAllZoneFacilitiesToFactionRequest", 0x09a404, { fields: [] }],
    [
        "AdminCommand.SetAllZoneFacilitiesToFactionRequest",
        0x0aa404,
        { fields: [] },
    ],
    ["Command.FacilityResetMapRequest", 0x09a504, { fields: [] }],
    ["AdminCommand.FacilityResetMapRequest", 0x0aa504, { fields: [] }],
    ["Command.DesignDataChanges", 0x09a604, { fields: [] }],
    ["AdminCommand.DesignDataChanges", 0x0aa604, { fields: [] }],
    ["Command.GiveXp", 0x09a704, { fields: [] }],
    ["AdminCommand.GiveXp", 0x0aa704, { fields: [] }],
    ["Command.GiveRank", 0x09a804, { fields: [] }],
    ["AdminCommand.GiveRank", 0x0aa804, { fields: [] }],
    ["Command.PlayerExperienceRequest", 0x09a904, { fields: [] }],
    ["AdminCommand.PlayerExperienceRequest", 0x0aa904, { fields: [] }],
    ["Command.Noclip", 0x09aa04, { fields: [] }],
    ["AdminCommand.Noclip", 0x0aaa04, { fields: [] }],
    ["Command.VerifyAdminPermission", 0x09ab04, { fields: [] }],
    ["AdminCommand.VerifyAdminPermission", 0x0aab04, { fields: [] }],
    ["Command.RegionRequest", 0x09ac04, { fields: [] }],
    ["AdminCommand.RegionRequest", 0x0aac04, { fields: [] }],
    ["Command.RegionReply", 0x09ad04, { fields: [] }],
    ["AdminCommand.RegionReply", 0x0aad04, { fields: [] }],
    ["Command.RegionRewardsReply", 0x09ae04, { fields: [] }],
    ["AdminCommand.RegionRewardsReply", 0x0aae04, { fields: [] }],
    ["Command.RegionFactionRewardsReply", 0x09af04, { fields: [] }],
    ["AdminCommand.RegionFactionRewardsReply", 0x0aaf04, { fields: [] }],
    ["Command.FacilityListNpcReply", 0x09b004, { fields: [] }],
    ["AdminCommand.FacilityListNpcReply", 0x0ab004, { fields: [] }],
    ["Command.FacilityListReply", 0x09b104, { fields: [] }],
    ["AdminCommand.FacilityListReply", 0x0ab104, { fields: [] }],
    ["Command.PingServer", 0x09b204, { fields: [] }],
    ["AdminCommand.PingServer", 0x0ab204, { fields: [] }],
    ["Command.AnimDebug", 0x09b304, { fields: [] }],
    ["AdminCommand.AnimDebug", 0x0ab304, { fields: [] }],
    ["Command.RemoteClientAnimDebugRequest", 0x09b404, { fields: [] }],
    ["AdminCommand.RemoteClientAnimDebugRequest", 0x0ab404, { fields: [] }],
    ["Command.RemoteClientAnimDebugReply", 0x09b504, { fields: [] }],
    ["AdminCommand.RemoteClientAnimDebugReply", 0x0ab504, { fields: [] }],
    ["Command.RewardBuffManagerGiveReward", 0x09b604, { fields: [] }],
    ["AdminCommand.RewardBuffManagerGiveReward", 0x0ab604, { fields: [] }],
    ["Command.RewardBuffManagerAddPlayers", 0x09b704, { fields: [] }],
    ["AdminCommand.RewardBuffManagerAddPlayers", 0x0ab704, { fields: [] }],
    ["Command.RewardBuffManagerRemovePlayers", 0x09b804, { fields: [] }],
    ["AdminCommand.RewardBuffManagerRemovePlayers", 0x0ab804, { fields: [] }],
    ["Command.RewardBuffManagerClearAllPlayers", 0x09b904, { fields: [] }],
    ["AdminCommand.RewardBuffManagerClearAllPlayers", 0x0ab904, { fields: [] }],
    ["Command.RewardBuffManagerListAll", 0x09ba04, { fields: [] }],
    ["AdminCommand.RewardBuffManagerListAll", 0x0aba04, { fields: [] }],
    ["Command.QueryNpcRequest", 0x09bb04, { fields: [] }],
    ["AdminCommand.QueryNpcRequest", 0x0abb04, { fields: [] }],
    ["Command.QueryNpcReply", 0x09bc04, { fields: [] }],
    ["AdminCommand.QueryNpcReply", 0x0abc04, { fields: [] }],
    ["Command.ZonePlayerCount", 0x09bd04, { fields: [] }],
    ["AdminCommand.ZonePlayerCount", 0x0abd04, { fields: [] }],
    ["Command.GriefRequest", 0x09be04, { fields: [] }],
    ["AdminCommand.GriefRequest", 0x0abe04, { fields: [] }],
    ["Command.TeleportToObjectTag", 0x09bf04, { fields: [] }],
    ["AdminCommand.TeleportToObjectTag", 0x0abf04, { fields: [] }],
    ["Command.DamagePlayer", 0x09c004, { fields: [] }],
    ["AdminCommand.DamagePlayer", 0x0ac004, { fields: [] }],
    ["Command.HexPermissions", 0x09c104, { fields: [] }],
    ["AdminCommand.HexPermissions", 0x0ac104, { fields: [] }],
    ["Command.SpyRequest", 0x09c204, { fields: [] }],
    ["AdminCommand.SpyRequest", 0x0ac204, { fields: [] }],
    ["Command.SpyReply", 0x09c304, { fields: [] }],
    ["AdminCommand.SpyReply", 0x0ac304, { fields: [] }],
    ["Command.GatewayProfilerRegistration", 0x09c404, { fields: [] }],
    ["AdminCommand.GatewayProfilerRegistration", 0x0ac404, { fields: [] }],
    [
        "Command.RunSpeed",
        0x09c504,
        {
            fields: [{ name: "runSpeed", type: "float", defaultValue: 0.0 }],
        },
    ],
    [
        "AdminCommand.RunSpeed",
        0x0ac504,
        {
            fields: [{ name: "runSpeed", type: "float", defaultValue: 0.0 }],
        },
    ],
    ["Command.LocationRequest", 0x09c604, { fields: [] }],
    ["AdminCommand.LocationRequest", 0x0ac604, { fields: [] }],
    ["Command.GriefBase", 0x09c704, { fields: [] }],
    ["AdminCommand.GriefBase", 0x0ac704, { fields: [] }],
    ["Command.PlayerRenameRequest", 0x09c804, { fields: [] }],
    ["AdminCommand.PlayerRenameRequest", 0x0ac804, { fields: [] }],
    ["Command.EffectBase", 0x09c904, { fields: [] }],
    ["AdminCommand.EffectBase", 0x0ac904, { fields: [] }],
    ["Command.AbilityBase", 0x09ca04, { fields: [] }],
    ["AdminCommand.AbilityBase", 0x0aca04, { fields: [] }],
    ["Command.AcquireTimerBase", 0x09cb04, { fields: [] }],
    ["AdminCommand.AcquireTimerBase", 0x0acb04, { fields: [] }],
    ["Command.ReserveNameRequest", 0x09cc04, { fields: [] }],
    ["AdminCommand.ReserveNameRequest", 0x0acc04, { fields: [] }],
    ["Command.InternalConnectionBypass", 0x09cd04, { fields: [] }],
    ["AdminCommand.InternalConnectionBypass", 0x0acd04, { fields: [] }],
    ["Command.Queue", 0x09ce04, { fields: [] }],
    ["AdminCommand.Queue", 0x0ace04, { fields: [] }],
    ["Command.CharacterStatQuery", 0x09cf04, { fields: [] }],
    ["AdminCommand.CharacterStatQuery", 0x0acf04, { fields: [] }],
    ["Command.CharacterStatReply", 0x09d004, { fields: [] }],
    ["AdminCommand.CharacterStatReply", 0x0ad004, { fields: [] }],
    ["Command.LockStatusReply", 0x09d104, { fields: [] }],
    ["AdminCommand.LockStatusReply", 0x0ad104, { fields: [] }],
    ["Command.StatTracker", 0x09d204, { fields: [] }],
    ["AdminCommand.StatTracker", 0x0ad204, { fields: [] }],
    ["Command.ItemBase", 0x09d304, { fields: [] }],
    ["AdminCommand.Items.ListAccountItems", 0x0ad30401, { fields: [] }],
    ["AdminCommand.Items.ListItemRentalTerms", 0x0ad30402, { fields: [] }],
    ["AdminCommand.Items.ListItemUseOptions", 0x0ad30403, { fields: [] }],
    ["AdminCommand.Items.ListItemTimers", 0x0ad30404, { fields: [] }],
    ["AdminCommand.Items.ExpireItemTrialTimers", 0x0ad30405, { fields: [] }],
    ["AdminCommand.Items.ExpireItemRentalTimers", 0x0ad30406, { fields: [] }],
    ["AdminCommand.Items.ClearItemTrialTimers", 0x0ad30407, { fields: [] }],
    ["AdminCommand.Items.ClearItemRentalTimers", 0x0ad30408, { fields: [] }],
    ["AdminCommand.Items.TestAddItem", 0x0ad30409, { fields: [] }],
    ["AdminCommand.Items.AddAccountItem", 0x0ad3040a, { fields: [] }],
    ["AdminCommand.Items.RemoveAccountItem", 0x0ad3040b, { fields: [] }],
    ["AdminCommand.Items.ClearAccountItems", 0x0ad3040c, { fields: [] }],
    ["AdminCommand.Items.ConvertAccountItem", 0x0ad3040d, { fields: [] }],
    ["Command.CurrencyBase", 0x09d404, { fields: [] }],
    ["AdminCommand.Currency.ListCurrencyDiscounts", 0x0ad40401, { fields: [] }],
    [
        "AdminCommand.Currency.RequestSetCurrencyDiscount",
        0x0ad40402,
        { fields: [] },
    ],
    ["Command.ImplantBase", 0x09d504, { fields: [] }],
    ["AdminCommand.ImplantBase", 0x0ad504, { fields: [] }],
    ["Command.FileDistribution", 0x09d604, { fields: [] }],
    ["AdminCommand.FileDistribution", 0x0ad604, { fields: [] }],
    ["Command.TopReports", 0x09d704, { fields: [] }],
    ["AdminCommand.TopReports", 0x0ad704, { fields: [] }],
    ["Command.ClearAllReports", 0x09d804, { fields: [] }],
    ["AdminCommand.ClearAllReports", 0x0ad804, { fields: [] }],
    ["Command.GetReport", 0x09d904, { fields: [] }],
    ["AdminCommand.GetReport", 0x0ad904, { fields: [] }],
    ["Command.DeleteReport", 0x09da04, { fields: [] }],
    ["AdminCommand.DeleteReport", 0x0ada04, { fields: [] }],
    ["Command.UserReports", 0x09db04, { fields: [] }],
    ["AdminCommand.UserReports", 0x0adb04, { fields: [] }],
    ["Command.ClearUserReports", 0x09dc04, { fields: [] }],
    ["AdminCommand.ClearUserReports", 0x0adc04, { fields: [] }],
    ["Command.WhoRequest", 0x09dd04, { fields: [] }],
    ["AdminCommand.WhoRequest", 0x0add04, { fields: [] }],
    ["Command.WhoReply", 0x09de04, { fields: [] }],
    ["AdminCommand.WhoReply", 0x0ade04, { fields: [] }],
    ["Command.FindRequest", 0x09df04, { fields: [] }],
    ["AdminCommand.FindRequest", 0x0adf04, { fields: [] }],
    ["Command.FindReply", 0x09e004, { fields: [] }],
    ["AdminCommand.FindReply", 0x0ae004, { fields: [] }],
    ["Command.CaisBase", 0x09e104, { fields: [] }],
    ["AdminCommand.CaisBase", 0x0ae104, { fields: [] }],
    ["Command.MyRealtimeGatewayMovement", 0x09e204, { fields: [] }],
    ["AdminCommand.MyRealtimeGatewayMovement", 0x0ae204, { fields: [] }],
    ["Command.ObserverCam", 0x09e304, { fields: [] }],
    ["AdminCommand.ObserverCam", 0x0ae304, { fields: [] }],
    ["Command.AddItemContentPack", 0x09e404, { fields: [] }],
    ["AdminCommand.AddItemContentPack", 0x0ae404, { fields: [] }],
    ["Command.CharacterSlotBase", 0x09e504, { fields: [] }],
    ["AdminCommand.CharacterSlotBase", 0x0ae504, { fields: [] }],
    ["Command.ResourceBase", 0x09e804, { fields: [] }],
    ["AdminCommand.ResourceBase", 0x0ae804, { fields: [] }],
    ["Command.CharacterStateBase", 0x09e904, { fields: [] }],
    ["AdminCommand.CharacterStateBase", 0x0ae904, { fields: [] }],
    ["Command.ResistsBase", 0x09ea04, { fields: [] }],
    ["AdminCommand.ResistsBase", 0x0aea04, { fields: [] }],
    ["Command.LoadoutBase", 0x09eb04, { fields: [] }],
    ["AdminCommand.LoadoutBase", 0x0aeb04, { fields: [] }],
    ["Command.GiveBotOrders", 0x09f104, { fields: [] }],
    ["AdminCommand.GiveBotOrders", 0x0af104, { fields: [] }],
    ["Command.ReceiveBotOrders", 0x09f204, { fields: [] }],
    ["AdminCommand.ReceiveBotOrders", 0x0af204, { fields: [] }],
    ["Command.SetIgnoreMaxTrackables", 0x09ec04, { fields: [] }],
    ["AdminCommand.SetIgnoreMaxTrackables", 0x0aec04, { fields: [] }],
    ["Command.ToggleNavigationLab", 0x09ed04, { fields: [] }],
    ["AdminCommand.ToggleNavigationLab", 0x0aed04, { fields: [] }],
    ["Command.RequirementDebug", 0x09ee04, { fields: [] }],
    ["AdminCommand.RequirementDebug", 0x0aee04, { fields: [] }],
    ["Command.ConsolePrint", 0x09ef04, { fields: [] }],
    ["AdminCommand.ConsolePrint", 0x0aef04, { fields: [] }],
    ["Command.ReconcileItemList", 0x09f304, { fields: [] }],
    ["AdminCommand.ReconcileItemList", 0x0af304, { fields: [] }],
    ["Command.ReconcileItemListReply", 0x09f404, { fields: [] }],
    ["AdminCommand.ReconcileItemListReply", 0x0af404, { fields: [] }],
    ["Command.FillItem", 0x09f504, { fields: [] }],
    ["AdminCommand.FillItem", 0x0af504, { fields: [] }],
    ["Command.HeatMapList", 0x09f604, { fields: [] }],
    ["AdminCommand.HeatMapList", 0x0af604, { fields: [] }],
    ["Command.HeatMapResponse", 0x09f704, { fields: [] }],
    ["AdminCommand.HeatMapResponse", 0x0af704, { fields: [] }],
    ["Command.Weather", 0x09f904, { fields: [] }],
    ["AdminCommand.Weather", 0x0af904, { fields: [] }],
    ["Command.LockBase", 0x09fa04, { fields: [] }],
    ["AdminCommand.LockBase", 0x0afa04, { fields: [] }],
    ["Command.AbandonedItemsStats", 0x09fb04, { fields: [] }],
    ["AdminCommand.AbandonedItemsStats", 0x0afb04, { fields: [] }],
    ["Command.DatabaseBase", 0x09fd04, { fields: [] }],
    ["AdminCommand.DatabaseBase", 0x0afd04, { fields: [] }],
    ["Command.ModifyEntitlement", 0x09fe04, { fields: [] }],
    ["AdminCommand.ModifyEntitlement", 0x0afe04, { fields: [] }],
    [
        "ClientBeginZoning",
        0x0b,
        {
            fields: [
                { name: "zoneName", type: "string", defaultValue: "" },
                { name: "zoneType", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                {
                    name: "skyData",
                    type: "schema",
                    fields: [
                        { name: "name", type: "string", defaultValue: "" },
                        { name: "unknownDword1", type: "int32" },
                        { name: "unknownDword2", type: "int32" },
                        { name: "unknownDword3", type: "int32" },
                        { name: "unknownDword4", type: "int32" },
                        { name: "unknownDword5", type: "int32" },
                        { name: "unknownDword6", type: "int32" },
                        { name: "unknownDword7", type: "int32" },
                        { name: "unknownDword8", type: "int32" },
                        { name: "unknownDword9", type: "int32" },
                        { name: "unknownDword10", type: "int32" },
                        { name: "unknownDword11", type: "int32" },
                        { name: "unknownDword12", type: "int32" },
                        { name: "unknownDword13", type: "int32" },
                        { name: "unknownDword14", type: "int32" },
                        { name: "unknownDword15", type: "int32" },
                        { name: "unknownDword16", type: "int32" },
                        { name: "unknownDword17", type: "int32" },
                        { name: "unknownDword18", type: "int32" },
                        { name: "unknownDword19", type: "int32" },
                        { name: "unknownDword20", type: "int32" },
                        { name: "unknownDword21", type: "int32" },
                        { name: "unknownDword22", type: "int32" },
                        { name: "unknownDword23", type: "int32" },
                        { name: "unknownDword24", type: "int32" },
                        { name: "unknownDword25", type: "int32" },
                        {
                            name: "unknownArray",
                            type: "array",
                            length: 50,
                            fields: [
                                { name: "unknownDword1", type: "int32" },
                                { name: "unknownDword2", type: "int32" },
                                { name: "unknownDword3", type: "int32" },
                                { name: "unknownDword4", type: "int32" },
                                { name: "unknownDword5", type: "int32" },
                                { name: "unknownDword6", type: "int32" },
                                { name: "unknownDword7", type: "int32" },
                            ],
                        },
                    ],
                },
                { name: "zoneId1", type: "uint32", defaultValue: 0 },
                { name: "zoneId2", type: "uint32", defaultValue: 0 },
                { name: "nameId", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean7", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["Combat.AutoAttackTarget", 0x0c01, { fields: [] }],
    ["Combat.AutoAttackOff", 0x0c02, { fields: [] }],
    ["Combat.SingleAttackTarget", 0x0c03, { fields: [] }],
    ["Combat.AttackTargetDamage", 0x0c04, { fields: [] }],
    ["Combat.AttackAttackerMissed", 0x0c05, { fields: [] }],
    ["Combat.AttackTargetDodged", 0x0c06, { fields: [] }],
    ["Combat.AttackProcessed", 0x0c07, { fields: [] }],
    ["Combat.EnableBossDisplay", 0x0c09, { fields: [] }],
    ["Combat.AttackTargetBlocked", 0x0c0a, { fields: [] }],
    ["Combat.AttackTargetParried", 0x0c0b, { fields: [] }],
    ["Mail", 0x0e, { fields: [] }],
    ["PlayerUpdate.None", 0x0f00, { fields: [] }],
    [
        "PlayerUpdate.RemovePlayer",
        0x0f010000,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    [
        "PlayerUpdate.RemovePlayerGracefully",
        0x0f010100,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknown5", type: "boolean", defaultValue: false },
                { name: "unknown6", type: "uint32", defaultValue: 0 },
                { name: "unknown7", type: "uint32", defaultValue: 0 },
                { name: "unknown8", type: "uint32", defaultValue: 0 },
                { name: "unknown9", type: "uint32", defaultValue: 0 },
                { name: "unknown10", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.Knockback", 0x0f02, { fields: [] }],
    ["PlayerUpdate.UpdateHitpoints", 0x0f03, { fields: [] }],
    ["PlayerUpdate.PlayAnimation", 0x0f04, { fields: [] }],
    ["PlayerUpdate.AddNotifications", 0x0f05, { fields: [] }],
    ["PlayerUpdate.RemoveNotifications", 0x0f06, { fields: [] }],
    [
        "PlayerUpdate.NpcRelevance",
        0x0f07,
        {
            fields: [
                {
                    name: "npcs",
                    type: "array",
                    fields: [
                        { name: "guid", type: "uint64", defaultValue: "0" },
                        { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["PlayerUpdate.UpdateScale", 0x0f08, { fields: [] }],
    ["PlayerUpdate.UpdateTemporaryAppearance", 0x0f09, { fields: [] }],
    ["PlayerUpdate.RemoveTemporaryAppearance", 0x0f0a, { fields: [] }],
    ["PlayerUpdate.PlayCompositeEffect", 0x0f0b, { fields: [] }],
    ["PlayerUpdate.SetLookAt", 0x0f0c, { fields: [] }],
    ["PlayerUpdate.RenamePlayer", 0x0f0d, { fields: [] }],
    [
        "PlayerUpdate.UpdateCharacterState",
        0x0f0e,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "gameTime", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.QueueAnimation", 0x0f0f, { fields: [] }],
    ["PlayerUpdate.ExpectedSpeed", 0x0f10, { fields: [] }],
    ["PlayerUpdate.ScriptedAnimation", 0x0f11, { fields: [] }],
    ["PlayerUpdate.ThoughtBubble", 0x0f12, { fields: [] }],
    ["PlayerUpdate.SetDisposition", 0x0f13, { fields: [] }],
    ["PlayerUpdate.LootEvent", 0x0f14, { fields: [] }],
    ["PlayerUpdate.SlotCompositeEffectOverride", 0x0f15, { fields: [] }],
    ["PlayerUpdate.EffectPackage", 0x0f16, { fields: [] }],
    ["PlayerUpdate.PreferredLanguages", 0x0f17, { fields: [] }],
    ["PlayerUpdate.CustomizationChange", 0x0f18, { fields: [] }],
    ["PlayerUpdate.PlayerTitle", 0x0f19, { fields: [] }],
    ["PlayerUpdate.AddEffectTagCompositeEffect", 0x0f1a, { fields: [] }],
    ["PlayerUpdate.RemoveEffectTagCompositeEffect", 0x0f1b, { fields: [] }],
    ["PlayerUpdate.SetSpawnAnimation", 0x0f1c, { fields: [] }],
    ["PlayerUpdate.CustomizeNpc", 0x0f1d, { fields: [] }],
    ["PlayerUpdate.SetSpawnerActivationEffect", 0x0f1e, { fields: [] }],
    ["PlayerUpdate.SetComboState", 0x0f1f, { fields: [] }],
    ["PlayerUpdate.SetSurpriseState", 0x0f20, { fields: [] }],
    ["PlayerUpdate.RemoveNpcCustomization", 0x0f21, { fields: [] }],
    ["PlayerUpdate.ReplaceBaseModel", 0x0f22, { fields: [] }],
    ["PlayerUpdate.SetCollidable", 0x0f23, { fields: [] }],
    ["PlayerUpdate.UpdateOwner", 0x0f24, { fields: [] }],
    ["PlayerUpdate.WeaponStance", 0x0f25, { fields: [] }],
    ["PlayerUpdate.UpdateTintAlias", 0x0f26, { fields: [] }],
    ["PlayerUpdate.MoveOnRail", 0x0f27, { fields: [] }],
    ["PlayerUpdate.ClearMovementRail", 0x0f28, { fields: [] }],
    ["PlayerUpdate.MoveOnRelativeRail", 0x0f29, { fields: [] }],
    [
        "PlayerUpdate.Destroyed",
        0x0f2a,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                { name: "unknown3", type: "uint32", defaultValue: 0 },
                { name: "unknown4", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.SeekTarget", 0x0f2b, { fields: [] }],
    ["PlayerUpdate.SeekTargetUpdate", 0x0f2c, { fields: [] }],
    [
        "PlayerUpdate.UpdateActiveWieldType",
        0x0f2d,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.LaunchProjectile", 0x0f2e, { fields: [] }],
    ["PlayerUpdate.SetSynchronizedAnimations", 0x0f2f, { fields: [] }],
    ["PlayerUpdate.HudMessage", 0x0f30, { fields: [] }],
    [
        "PlayerUpdate.CustomizationData",
        0x0f31,
        {
            fields: [
                {
                    name: "customizationData",
                    type: "array",
                    fields: [
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "modelName", type: "string", defaultValue: "" },
                        { name: "unknown3", type: "uint32", defaultValue: 0 },
                        { name: "unknown4", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["PlayerUpdate.MemberStatus", 0x0f32, { fields: [] }],
    ["PlayerUpdate.SetCurrentAdventure", 0x0f33, { fields: [] }],
    ["PlayerUpdate.StartHarvest", 0x0f34, { fields: [] }],
    ["PlayerUpdate.StopHarvest", 0x0f35, { fields: [] }],
    [
        "PlayerUpdate.KnockedOut",
        0x0f36,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["PlayerUpdate.KnockedOutDamageReport", 0x0f37, { fields: [] }],
    [
        "PlayerUpdate.Respawn",
        0x0f38,
        {
            fields: [
                { name: "respawnType", type: "uint8", defaultValue: 0 },
                { name: "respawnGuid", type: "uint64", defaultValue: "0" },
                { name: "profileId", type: "uint32", defaultValue: 0 },
                { name: "profileId2", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "PlayerUpdate.RespawnReply",
        0x0f39,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "status", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["PlayerUpdate.ReadyToReviveResponse", 0x0f3a, { fields: [] }],
    ["PlayerUpdate.ActivateProfile", 0x0f3b, { fields: [] }],
    ["PlayerUpdate.SetSpotted", 0x0f3c, { fields: [] }],
    [
        "PlayerUpdate.Jet",
        0x0f3d,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "state", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.Turbo", 0x0f3e, { fields: [] }],
    ["PlayerUpdate.StartRevive", 0x0f3f, { fields: [] }],
    ["PlayerUpdate.StopRevive", 0x0f40, { fields: [] }],
    ["PlayerUpdate.ReadyToRevive", 0x0f41, { fields: [] }],
    [
        "PlayerUpdate.SetFaction",
        0x0f42,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "factionId", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    [
        "PlayerUpdate.SetBattleRank",
        0x0f43,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "battleRank", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.StartHeal", 0x0f44, { fields: [] }],
    ["PlayerUpdate.StopHeal", 0x0f45, { fields: [] }],
    ["PlayerUpdate.Currency", 0x0f46, { fields: [] }],
    ["PlayerUpdate.RewardCurrency", 0x0f47, { fields: [] }],
    [
        "PlayerUpdate.ManagedObject",
        0x0f48,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "guid2", type: "uint64", defaultValue: "0" },
                { name: "characterId", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    ["PlayerUpdate.ManagedObjectRequestControl", 0x0f49, { fields: [] }],
    ["PlayerUpdate.ManagedObjectResponseControl", 0x0f4a, { fields: [] }],
    ["PlayerUpdate.ManagedObjectReleaseControl", 0x0f4b, { fields: [] }],
    ["PlayerUpdate.MaterialTypeOverride", 0x0f4c, { fields: [] }],
    ["PlayerUpdate.DebrisLaunch", 0x0f4d, { fields: [] }],
    ["PlayerUpdate.HideCorpse", 0x0f4e, { fields: [] }],
    [
        "PlayerUpdate.CharacterStateDelta",
        0x0f4f,
        {
            fields: [
                { name: "guid1", type: "uint64", defaultValue: "0" },
                { name: "guid2", type: "uint64", defaultValue: "0" },
                { name: "guid3", type: "uint64", defaultValue: "0" },
                { name: "guid4", type: "uint64", defaultValue: "0" },
                { name: "gameTime", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["PlayerUpdate.UpdateStat", 0x0f50, { fields: [] }],
    ["PlayerUpdate.AnimationRequest", 0x0f51, { fields: [] }],
    ["PlayerUpdate.NonPriorityCharacters", 0x0f53, { fields: [] }],
    ["PlayerUpdate.PlayWorldCompositeEffect", 0x0f54, { fields: [] }],
    ["PlayerUpdate.AFK", 0x0f55, { fields: [] }],
    [
        "PlayerUpdate.AddLightweightPc",
        0x0f56,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                {
                    name: "transientId",
                    type: "custom",
                    parser: readUnsignedIntWith2bitLengthValue,
                    packer: packUnsignedIntWith2bitLengthValue,
                },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "name", type: "string", defaultValue: "" },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                { name: "position", type: "floatvector3" },
                { name: "rotation", type: "floatvector4", defaultValue: [0, 0, 0, 0] },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                { name: "unknownGuid2", type: "uint64", defaultValue: "0" },
                { name: "unknownByte3", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    [
        "PlayerUpdate.AddLightweightNpc",
        0x0f57,
        {
            fields: lightWeightNpcSchema,
        },
    ],
    [
        "PlayerUpdate.AddLightweightVehicle",
        0x0f58,
        {
            fields: [
                { name: "npcData", type: "schema", fields: lightWeightNpcSchema },
                { name: "unknownGuid1", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                {
                    name: "positionUpdate",
                    type: "custom",
                    parser: readPositionUpdateData,
                    packer: packPositionUpdateData,
                },
                { name: "unknownString1", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["PlayerUpdate.AddProxiedObject", 0x0f59, { fields: [] }],
    ["PlayerUpdate.LightweightToFullPc", 0x0f5a, { fields: [] }],
    [
        "PlayerUpdate.LightweightToFullNpc",
        0x0f5b,
        {
            fields: fullNpcDataSchema,
        },
    ],
    [
        "PlayerUpdate.LightweightToFullVehicle",
        0x0f5c,
        {
            fields: [
                { name: "npcData", type: "schema", fields: fullNpcDataSchema },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                {
                    name: "unknownArray1",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                    ],
                },
                {
                    name: "unknownArray2",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownByte1", type: "boolean", defaultValue: false },
                    ],
                },
                {
                    name: "unknownVector1",
                    type: "floatvector4",
                    defaultValue: [0, 0, 0, 0],
                },
                {
                    name: "unknownVector2",
                    type: "floatvector4",
                    defaultValue: [0, 0, 0, 0],
                },
                { name: "unknownByte3", type: "uint8", defaultValue: 0 },
                {
                    name: "unknownArray3",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownArray4",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownArray5",
                    type: "array",
                    fields: [
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: [
                                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownString1",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                        {
                                            name: "unknownString2",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                            ],
                        },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknownArray6",
                    type: "array",
                    fields: [
                        { name: "unknownString1", type: "string", defaultValue: "" },
                    ],
                },
                {
                    name: "unknownArray7",
                    type: "array",
                    fields: itemWeaponDetailSubSchema1,
                },
                {
                    name: "unknownArray8",
                    type: "array",
                    fields: itemWeaponDetailSubSchema2,
                },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    [
        "PlayerUpdate.FullCharacterDataRequest",
        0x0f5d,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["PlayerUpdate.InitiateNameChange", 0x0f5e, { fields: [] }],
    ["PlayerUpdate.NameChangeResult", 0x0f5f, { fields: [] }],
    ["PlayerUpdate.NameValidationResult", 0x0f60, { fields: [] }],
    ["PlayerUpdate.Deploy", 0x0f61, { fields: [] }],
    ["PlayerUpdate.LowAmmoUpdate", 0x0f62, { fields: [] }],
    ["PlayerUpdate.KilledBy", 0x0f63, { fields: [] }],
    ["PlayerUpdate.MotorRunning", 0x0f64, { fields: [] }],
    ["PlayerUpdate.DroppedIemNotification", 0x0f65, { fields: [] }],
    ["PlayerUpdate.NoSpaceNotification", 0x0f66, { fields: [] }],
    ["PlayerUpdate.StartMultiStateDeath", 0x0f68, { fields: [] }],
    ["PlayerUpdate.AggroLevel", 0x0f69, { fields: [] }],
    ["PlayerUpdate.DoorState", 0x0f6a, { fields: [] }],
    ["PlayerUpdate.RequestToggleDoorState", 0x0f6b, { fields: [] }],
    [
        "PlayerUpdate.BeginCharacterAccess",
        0x0f6c,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    [
        "PlayerUpdate.EndCharacterAccess",
        0x0f6d,
        {
            fields: [{ name: "characterId", type: "uint64", defaultValue: "" }],
        },
    ],
    ["PlayerUpdate.UpdateMutateRights", 0x0f6e, { fields: [] }],
    ["PlayerUpdate.UpdateFogOfWar", 0x0f70, { fields: [] }],
    ["PlayerUpdate.SetAllowRespawn", 0x0f71, { fields: [] }],
    ["Ability.ClientRequestStartAbility", 0x1001, { fields: [] }],
    ["Ability.ClientRequestStopAbility", 0x1002, { fields: [] }],
    ["Ability.ClientMoveAndCast", 0x1003, { fields: [] }],
    ["Ability.Failed", 0x1004, { fields: [] }],
    ["Ability.StartCasting", 0x1005, { fields: [] }],
    ["Ability.Launch", 0x1006, { fields: [] }],
    ["Ability.Land", 0x1007, { fields: [] }],
    ["Ability.StartChanneling", 0x1008, { fields: [] }],
    ["Ability.StopCasting", 0x1009, { fields: [] }],
    ["Ability.StopAura", 0x100a, { fields: [] }],
    ["Ability.MeleeRefresh", 0x100b, { fields: [] }],
    ["Ability.AbilityDetails", 0x100c, { fields: [] }],
    ["Ability.PurchaseAbility", 0x100d, { fields: [] }],
    ["Ability.UpdateAbilityExperience", 0x100e, { fields: [] }],
    ["Ability.SetDefinition", 0x100f, { fields: [] }],
    ["Ability.RequestAbilityDefinition", 0x1010, { fields: [] }],
    ["Ability.AddAbilityDefinition", 0x1011, { fields: [] }],
    ["Ability.PulseLocationTargeting", 0x1012, { fields: [] }],
    ["Ability.ReceivePulseLocation", 0x1013, { fields: [] }],
    ["Ability.ActivateItemAbility", 0x1014, { fields: [] }],
    ["Ability.ActivateVehicleAbility", 0x1015, { fields: [] }],
    ["Ability.DeactivateItemAbility", 0x1016, { fields: [] }],
    ["Ability.DeactivateVehicleAbility", 0x1017, { fields: [] }],
    ["ClientUpdate.Hitpoints", 0x110100, { fields: [] }],
    [
        "ClientUpdate.ItemAdd",
        0x110200,
        {
            fields: [
                {
                    name: "itemAddData",
                    type: "custom",
                    parser: parseItemAddData,
                    packer: packItemAddData,
                },
            ],
        },
    ],
    ["ClientUpdate.ItemUpdate", 0x110300, { fields: [] }],
    ["ClientUpdate.ItemDelete", 0x110400, { fields: [] }],
    [
        "ClientUpdate.UpdateStat",
        0x110500,
        {
            fields: [{ name: "stats", type: "array", fields: statDataSchema }],
        },
    ],
    ["ClientUpdate.CollectionStart", 0x110600, { fields: [] }],
    ["ClientUpdate.CollectionRemove", 0x110700, { fields: [] }],
    ["ClientUpdate.CollectionAddEntry", 0x110800, { fields: [] }],
    ["ClientUpdate.CollectionRemoveEntry", 0x110900, { fields: [] }],
    ["ClientUpdate.UpdateLocation", 0x110a00, { fields: [] }],
    ["ClientUpdate.Mana", 0x110b00, { fields: [] }],
    ["ClientUpdate.UpdateProfileExperience", 0x110c00, { fields: [] }],
    ["ClientUpdate.AddProfileAbilitySetApl", 0x110d00, { fields: [] }],
    ["ClientUpdate.AddEffectTag", 0x110e00, { fields: [] }],
    ["ClientUpdate.RemoveEffectTag", 0x110f00, { fields: [] }],
    ["ClientUpdate.UpdateProfileRank", 0x111000, { fields: [] }],
    ["ClientUpdate.CoinCount", 0x111100, { fields: [] }],
    ["ClientUpdate.DeleteProfile", 0x111200, { fields: [] }],
    [
        "ClientUpdate.ActivateProfile",
        0x111300,
        {
            fields: [
                {
                    name: "profileData",
                    type: "byteswithlength",
                    fields: profileDataSchema,
                },
                {
                    name: "attachmentData",
                    type: "array",
                    fields: [
                        { name: "modelName", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                        { name: "tintAlias", type: "string", defaultValue: "" },
                        { name: "unknownString2", type: "string", defaultValue: "" },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "slotId", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownString2", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["ClientUpdate.AddAbility", 0x111400, { fields: [] }],
    ["ClientUpdate.NotifyPlayer", 0x111500, { fields: [] }],
    ["ClientUpdate.UpdateProfileAbilitySetApl", 0x111600, { fields: [] }],
    ["ClientUpdate.RemoveActionBars", 0x111700, { fields: [] }],
    ["ClientUpdate.UpdateActionBarSlot", 0x111800, { fields: [] }],
    [
        "ClientUpdate.DoneSendingPreloadCharacters",
        0x111900,
        {
            fields: [{ name: "unknownBoolean1", type: "uint8", defaultValue: 0 }],
        },
    ],
    ["ClientUpdate.SetGrandfatheredStatus", 0x111a00, { fields: [] }],
    ["ClientUpdate.UpdateActionBarSlotUsed", 0x111b00, { fields: [] }],
    ["ClientUpdate.PhaseChange", 0x111c00, { fields: [] }],
    ["ClientUpdate.UpdateKingdomExperience", 0x111d00, { fields: [] }],
    ["ClientUpdate.DamageInfo", 0x111e00, { fields: [] }],
    [
        "ClientUpdate.ZonePopulation",
        0x111f00,
        {
            fields: [{ name: "populations", type: "array", elementType: "uint8" }],
        },
    ],
    [
        "ClientUpdate.RespawnLocations",
        0x112000,
        {
            fields: [
                { name: "unknownFlags", type: "uint8", defaultValue: 0 },
                { name: "locations", type: "array", fields: respawnLocationDataSchema },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                {
                    name: "locations2",
                    type: "array",
                    fields: respawnLocationDataSchema,
                },
            ],
        },
    ],
    ["ClientUpdate.ModifyMovementSpeed", 0x112100, { fields: [] }],
    ["ClientUpdate.ModifyTurnRate", 0x112200, { fields: [] }],
    ["ClientUpdate.ModifyStrafeSpeed", 0x112300, { fields: [] }],
    ["ClientUpdate.UpdateManagedLocation", 0x112400, { fields: [] }],
    ["ClientUpdate.ScreenEffect", 0x112500, { fields: [] }],
    [
        "ClientUpdate.MovementVersion",
        0x112600,
        {
            fields: [{ name: "version", type: "uint8", defaultValue: 0 }],
        },
    ],
    [
        "ClientUpdate.ManagedMovementVersion",
        0x112700,
        {
            fields: [
                {
                    name: "version",
                    type: "custom",
                    parser: readUnsignedIntWith2bitLengthValue,
                    packer: packUnsignedIntWith2bitLengthValue,
                },
            ],
        },
    ],
    [
        "ClientUpdate.UpdateWeaponAddClips",
        0x112800,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    ["ClientUpdate.SpotProbation", 0x112900, { fields: [] }],
    ["ClientUpdate.DailyRibbonCount", 0x112a00, { fields: [] }],
    ["ClientUpdate.DespawnNpcUpdate", 0x112b00, { fields: [] }],
    ["ClientUpdate.LoyaltyPoints", 0x112c00, { fields: [] }],
    ["ClientUpdate.Membership", 0x112d00, { fields: [] }],
    ["ClientUpdate.ResetMissionRespawnTimer", 0x112e00, { fields: [] }],
    ["ClientUpdate.Freeze", 0x112f00, { fields: [] }],
    ["ClientUpdate.InGamePurchaseResult", 0x113000, { fields: [] }],
    ["ClientUpdate.QuizComplete", 0x113100, { fields: [] }],
    ["ClientUpdate.StartTimer", 0x113200, []],
    ["ClientUpdate.CompleteLogoutProcess", 0x113300, []],
    ["ClientUpdate.ProximateItems", 0x113400, []],
    ["ClientUpdate.TextAlert", 0x113500, []],
    ["ClientUpdate.ClearEntitlementValues", 0x113600, []],
    ["ClientUpdate.AddEntitlementValue", 0x113700, []],
    ["MiniGame", 0x12, { fields: [] }],
    ["Group", 0x13, { fields: [] }],
    ["Encounter", 0x14, { fields: [] }],
    ["Inventory", 0x15, { fields: [] }],
    [
        "SendZoneDetails",
        0x16,
        {
            fields: [
                { name: "zoneName", type: "string", defaultValue: "" },
                { name: "zoneType", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                {
                    name: "skyData",
                    type: "schema",
                    fields: [
                        { name: "name", type: "string", defaultValue: "" },
                        { name: "unknownDword1", type: "int32" },
                        { name: "unknownDword2", type: "int32" },
                        { name: "unknownDword3", type: "int32" },
                        { name: "fog", type: "int32" },
                        { name: "unknownDword5", type: "int32" },
                        { name: "unknownDword6", type: "int32" },
                        { name: "unknownDword7", type: "int32" },
                        { name: "unknownDword8", type: "int32" },
                        { name: "temperature", type: "int32" },
                        { name: "unknownDword10", type: "int32" },
                        { name: "unknownDword11", type: "int32" },
                        { name: "unknownDword12", type: "int32" },
                        { name: "unknownDword13", type: "int32" },
                        { name: "unknownDword14", type: "int32" },
                        { name: "unknownDword15", type: "int32" },
                        { name: "unknownDword16", type: "int32" },
                        { name: "unknownDword17", type: "int32" },
                        { name: "unknownDword18", type: "int32" },
                        { name: "unknownDword19", type: "int32" },
                        { name: "unknownDword20", type: "int32" },
                        { name: "unknownDword21", type: "int32" },
                        { name: "unknownDword22", type: "int32" },
                        { name: "unknownDword23", type: "int32" },
                        { name: "unknownDword24", type: "int32" },
                        { name: "unknownDword25", type: "int32" },
                        {
                            name: "unknownArray",
                            type: "array",
                            length: 50,
                            fields: [
                                { name: "unknownDword1", type: "int32" },
                                { name: "unknownDword2", type: "int32" },
                                { name: "unknownDword3", type: "int32" },
                                { name: "unknownDword4", type: "int32" },
                                { name: "unknownDword5", type: "int32" },
                                { name: "unknownDword6", type: "int32" },
                                { name: "unknownDword7", type: "int32" },
                            ],
                        },
                    ],
                },
                { name: "zoneId1", type: "uint32", defaultValue: 0 },
                { name: "zoneId2", type: "uint32", defaultValue: 0 },
                { name: "nameId", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean7", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["ReferenceData.ItemClassDefinitions", 0x1701, { fields: [] }],
    ["ReferenceData.ItemCategoryDefinitions", 0x1702, { fields: [] }],
    [
        "ReferenceData.ClientProfileData",
        0x1703,
        {
            fields: [
                {
                    name: "profiles",
                    type: "array",
                    fields: [
                        { name: "profileId", type: "uint32", defaultValue: 0 },
                        {
                            name: "profileData",
                            type: "schema",
                            fields: [
                                { name: "profileId", type: "uint32", defaultValue: 0 },
                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                { name: "descriptionId", type: "uint32", defaultValue: 0 },
                                { name: "profileType", type: "uint32", defaultValue: 0 },
                                { name: "iconId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                                {
                                    name: "unknownBoolean2",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                                { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword11", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "firstPersonArms1", type: "uint32", defaultValue: 0 },
                                { name: "firstPersonArms2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword14", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownArray2",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                                { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                                { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
                                { name: "unknownFloat4", type: "float", defaultValue: 0.0 },
                                { name: "unknownDword15", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword16", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword17", type: "uint32", defaultValue: 0 },
                                { name: "imageSetId1", type: "uint32", defaultValue: 0 },
                                { name: "imageSetId2", type: "uint32", defaultValue: 0 },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    [
        "ReferenceData.WeaponDefinitions",
        0x1704,
        {
            fields: [{ name: "data", type: "byteswithlength" }],
        },
    ],
    ["ReferenceData.ProjectileDefinitions", 0x1705, { fields: [] }],
    [
        "ReferenceData.VehicleDefinitions",
        0x1706,
        {
            fields: [
                {
                    name: "data",
                    type: "custom",
                    parser: parseVehicleReferenceData,
                    packer: packVehicleReferenceData,
                },
            ],
        },
    ],
    ["Objective", 0x18, { fields: [] }],
    ["Debug", 0x19, { fields: [] }],
    ["Ui.TaskAdd", 0x1a01, { fields: [] }],
    ["Ui.TaskUpdate", 0x1a02, { fields: [] }],
    ["Ui.TaskComplete", 0x1a03, { fields: [] }],
    ["Ui.TaskFail", 0x1a04, { fields: [] }],
    ["Ui.Unknown", 0x1a05, { fields: [] }],
    ["Ui.ExecuteScript", 0x1a07, { fields: [] }],
    ["Ui.StartTimer", 0x1a09, { fields: [] }],
    ["Ui.ResetTimer", 0x1a0a, { fields: [] }],
    ["Ui.ObjectiveTargetUpdate", 0x1a0d, { fields: [] }],
    ["Ui.Message", 0x1a0e, { fields: [] }],
    ["Ui.CinematicStartLookAt", 0x1a0f, { fields: [] }],
    ["Ui.WeaponHitFeedback", 0x1a10, { fields: [] }],
    ["Ui.HeadShotFeedback", 0x1a11, { fields: [] }],
    ["Ui.WaypointCooldown", 0x1a14, { fields: [] }],
    ["Ui.ZoneWaypoint", 0x1a15, { fields: [] }],
    ["Ui.WaypointNotify", 0x1a16, { fields: [] }],
    ["Ui.ContinentDominationNotification", 0x1a17, { fields: [] }],
    ["Ui.InteractStart", 0x1a18, { fields: [] }],
    ["Ui.SomeInteractionThing", 0x1a19, { fields: [] }],
    ["Ui.RewardNotification", 0x1a1a, { fields: [] }],
    ["Ui.WarpgateRotateWarning", 0x1a1b, { fields: [] }],
    ["Ui.SystemBroadcast", 0x1a1c, { fields: [] }],
    ["Quest", 0x1b, { fields: [] }],
    ["Reward", 0x1c, { fields: [] }],
    [
        "GameTimeSync",
        0x1d,
        {
            fields: [
                { name: "time", type: "uint64", defaultValue: "0" },
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["Pet", 0x1e, { fields: [] }],
    ["PointOfInterestDefinitionRequest", 0x1f, { fields: [] }],
    ["PointOfInterestDefinitionReply", 0x20, { fields: [] }],
    ["WorldTeleportRequest", 0x21, { fields: [] }],
    ["Trade", 0x22, { fields: [] }],
    ["EscrowGivePackage", 0x23, { fields: [] }],
    ["EscrowGotPackage", 0x24, { fields: [] }],
    ["UpdateEncounterDataCommon", 0x25, { fields: [] }],
    ["Recipe.Add", 0x2601, { fields: [] }],
    ["Recipe.ComponentUpdate", 0x2602, { fields: [] }],
    ["Recipe.Remove", 0x2603, { fields: [] }],
    [
        "Recipe.List",
        0x2605,
        {
            fields: [
                {
                    name: "recipes",
                    type: "array",
                    fields: [
                        { name: "recipeId", type: "uint32", defaultValue: 0 },
                        {
                            name: "recipeData",
                            type: "schema",
                            fields: [
                                { name: "recipeId", type: "uint32", defaultValue: 0 },
                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                { name: "iconId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "descriptionId", type: "uint32", defaultValue: 0 },
                                { name: "rewardCount", type: "uint32", defaultValue: 0 },
                                { name: "membersOnly", type: "boolean", defaultValue: false },
                                { name: "discovered", type: "uint32", defaultValue: 0 },
                                {
                                    name: "components",
                                    type: "array",
                                    fields: [
                                        { name: "componentId", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "componentData",
                                            type: "schema",
                                            fields: [
                                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                                { name: "iconId", type: "uint32", defaultValue: 0 },
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "descriptionId",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "requiredCount",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword2",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword3",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                { name: "itemId", type: "uint32", defaultValue: 0 },
                                            ],
                                        },
                                    ],
                                },
                                { name: "rewardItemId", type: "uint32", defaultValue: 0 },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    ["InGamePurchase.PreviewOrderRequest", 0x270100, { fields: [] }],
    ["InGamePurchase.PreviewOrderResponse", 0x270200, { fields: [] }],
    ["InGamePurchase.PlaceOrderRequest", 0x270300, { fields: [] }],
    ["InGamePurchase.PlaceOrderResponse", 0x270400, { fields: [] }],
    [
        "InGamePurchase.StoreBundles",
        0x27050000,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "storeId", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                {
                    name: "imageData",
                    type: "schema",
                    fields: [
                        { name: "imageSetId", type: "string", defaultValue: "" },
                        { name: "imageTintValue", type: "string", defaultValue: "" },
                    ],
                },
                {
                    name: "storeBundles",
                    type: "array",
                    fields: [
                        { name: "bundleId", type: "uint32", defaultValue: 0 },
                        {
                            name: "appStoreBundle",
                            type: "schema",
                            fields: [
                                {
                                    name: "storeBundle",
                                    type: "schema",
                                    fields: [
                                        {
                                            name: "marketingBundle",
                                            type: "schema",
                                            fields: [
                                                { name: "bundleId", type: "uint32", defaultValue: 0 },
                                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                                {
                                                    name: "descriptionId",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword4",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "imageData",
                                                    type: "schema",
                                                    fields: [
                                                        {
                                                            name: "imageSetId",
                                                            type: "string",
                                                            defaultValue: "",
                                                        },
                                                        {
                                                            name: "imageTintValue",
                                                            type: "string",
                                                            defaultValue: "",
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownBoolean1",
                                                    type: "boolean",
                                                    defaultValue: false,
                                                },
                                                {
                                                    name: "unknownString1",
                                                    type: "string",
                                                    defaultValue: "",
                                                },
                                                {
                                                    name: "stationCurrencyId",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                { name: "price", type: "uint32", defaultValue: 0 },
                                                { name: "currencyId", type: "uint32", defaultValue: 0 },
                                                {
                                                    name: "currencyPrice",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownDword9",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownTime1",
                                                    type: "uint64",
                                                    defaultValue: "0",
                                                },
                                                {
                                                    name: "unknownTime2",
                                                    type: "uint64",
                                                    defaultValue: "0",
                                                },
                                                {
                                                    name: "unknownDword10",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownBoolean2",
                                                    type: "boolean",
                                                    defaultValue: false,
                                                },
                                                {
                                                    name: "itemListDetails",
                                                    type: "array",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "imageSetId",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        { name: "itemId", type: "uint32", defaultValue: 0 },
                                                        {
                                                            name: "unknownString1",
                                                            type: "string",
                                                            defaultValue: "",
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        { name: "storeId", type: "uint32", defaultValue: 0 },
                                        { name: "categoryId", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean1",
                                            type: "boolean",
                                            defaultValue: false,
                                        },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownBoolean2",
                                            type: "boolean",
                                            defaultValue: false,
                                        },
                                        {
                                            name: "unknownBoolean3",
                                            type: "boolean",
                                            defaultValue: false,
                                        },
                                        {
                                            name: "unknownBoolean4",
                                            type: "boolean",
                                            defaultValue: false,
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                                { name: "memberSalePrice", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword11", type: "uint32", defaultValue: 0 },
                                { name: "unknownString2", type: "string", defaultValue: "" },
                                { name: "unknownDword12", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                            ],
                        },
                    ],
                },
                { name: "offset", type: "debugoffset" },
            ],
        },
    ],
    ["InGamePurchase.StoreBundleStoreUpdate", 0x27050001, { fields: [] }],
    ["InGamePurchase.StoreBundleStoreBundleUpdate", 0x27050002, { fields: [] }],
    ["InGamePurchase.StoreBundleCategoryGroups", 0x270600, { fields: [] }],
    [
        "InGamePurchase.StoreBundleCategories",
        0x270700,
        {
            fields: [
                {
                    name: "categories",
                    type: "array",
                    fields: [
                        { name: "categoryId", type: "uint32", defaultValue: 0 },
                        {
                            name: "categoryData",
                            type: "schema",
                            fields: [
                                { name: "categoryId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                                { name: "unknownString2", type: "string", defaultValue: "" },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownArray1",
                                    type: "array",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    ["InGamePurchase.ExclusivePartnerStoreBundles", 0x270800, { fields: [] }],
    ["InGamePurchase.StoreBundleGroups", 0x270900, { fields: [] }],
    ["InGamePurchase.WalletInfoRequest", 0x270a00, { fields: [] }],
    [
        "InGamePurchase.WalletInfoResponse",
        0x270b00,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownString2", type: "string", defaultValue: "" },
                { name: "unknownBoolean2", type: "boolean", defaultValue: false },
            ],
        },
    ],
    ["InGamePurchase.ServerStatusRequest", 0x270c00, { fields: [] }],
    ["InGamePurchase.ServerStatusResponse", 0x270d00, { fields: [] }],
    ["InGamePurchase.StationCashProductsRequest", 0x270e00, { fields: [] }],
    ["InGamePurchase.StationCashProductsResponse", 0x270f00, { fields: [] }],
    ["InGamePurchase.CurrencyCodesRequest", 0x271000, { fields: [] }],
    ["InGamePurchase.CurrencyCodesResponse", 0x271100, { fields: [] }],
    ["InGamePurchase.StateCodesRequest", 0x271200, { fields: [] }],
    ["InGamePurchase.StateCodesResponse", 0x271300, { fields: [] }],
    ["InGamePurchase.CountryCodesRequest", 0x271400, { fields: [] }],
    ["InGamePurchase.CountryCodesResponse", 0x271500, { fields: [] }],
    ["InGamePurchase.SubscriptionProductsRequest", 0x271600, { fields: [] }],
    ["InGamePurchase.SubscriptionProductsResponse", 0x271700, { fields: [] }],
    [
        "InGamePurchase.EnableMarketplace",
        0x271800,
        {
            fields: [
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownBoolean2", type: "boolean", defaultValue: false },
            ],
        },
    ],
    [
        "InGamePurchase.AcccountInfoRequest",
        0x271900,
        {
            fields: [{ name: "locale", type: "string", defaultValue: "" }],
        },
    ],
    ["InGamePurchase.AcccountInfoResponse", 0x271a00, { fields: [] }],
    ["InGamePurchase.StoreBundleContentRequest", 0x271b00, { fields: [] }],
    ["InGamePurchase.StoreBundleContentResponse", 0x271c00, { fields: [] }],
    ["InGamePurchase.ClientStatistics", 0x271d00, { fields: [] }],
    [
        "InGamePurchase.SendMannequinStoreBundlesToClient",
        0x271e00,
        { fields: [] },
    ],
    ["InGamePurchase.DisplayMannequinStoreBundles", 0x271f00, { fields: [] }],
    [
        "InGamePurchase.ItemOfTheDay",
        0x272000,
        {
            fields: [{ name: "bundleId", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["InGamePurchase.EnablePaymentSources", 0x272100, { fields: [] }],
    ["InGamePurchase.SetMembershipFreeItemInfo", 0x272200, { fields: [] }],
    ["InGamePurchase.WishListAddBundle", 0x272300, { fields: [] }],
    ["InGamePurchase.WishListRemoveBundle", 0x272400, { fields: [] }],
    ["InGamePurchase.PlaceOrderRequestClientTicket", 0x272500, { fields: [] }],
    ["InGamePurchase.GiftOrderNotification", 0x272600, { fields: [] }],
    [
        "InGamePurchase.ActiveSchedules",
        0x272700,
        {
            fields: [
                {
                    name: "unknown1",
                    type: "array",
                    fields: [{ name: "id", type: "uint32", defaultValue: 0 }],
                },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                {
                    name: "unknown3",
                    type: "array",
                    fields: [
                        { name: "scheduleId", type: "uint32", defaultValue: 0 },
                        { name: "time", type: "uint32", defaultValue: 0 },
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "unknown2", type: "uint8", defaultValue: 0 },
                        { name: "unknown3", type: "uint8", defaultValue: 0 },
                        { name: "unknown4", type: "uint8", defaultValue: 0 },
                        { name: "unknown5", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["InGamePurchase.LoyaltyInfoAndStoreRequest", 0x272800, { fields: [] }],
    ["InGamePurchase.NudgeOfferNotification", 0x272900, { fields: [] }],
    ["InGamePurchase.NudgeRequestStationCashProducts", 0x272a00, { fields: [] }],
    ["InGamePurchase.SpiceWebAuthUrlRequest", 0x272b00, { fields: [] }],
    ["InGamePurchase.SpiceWebAuthUrlResponse", 0x272c00, { fields: [] }],
    ["InGamePurchase.BundlePriceUpdate", 0x272d00, { fields: [] }],
    ["InGamePurchase.WalletBalanceUpdate", 0x272e00, { fields: [] }],
    ["InGamePurchase.MemberFreeItemCount", 0x272f00, { fields: [] }],
    [
        "QuickChat.SendData",
        0x280100,
        {
            fields: [
                {
                    name: "commands",
                    type: "array",
                    fields: [
                        { name: "commandId", type: "uint32", defaultValue: 0 },
                        {
                            name: "commandData",
                            type: "schema",
                            fields: [
                                { name: "commandId", type: "uint32", defaultValue: 0 },
                                { name: "menuStringId", type: "uint32", defaultValue: 0 },
                                { name: "chatStringId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    ["QuickChat.SendTell", 0x2802, { fields: [] }],
    ["QuickChat.SendChatToChannel", 0x2803, { fields: [] }],
    ["Report", 0x29, { fields: [] }],
    ["LiveGamer", 0x2a, { fields: [] }],
    ["Acquaintance", 0x2b, { fields: [] }],
    ["ClientServerShuttingDown", 0x2c, { fields: [] }],
    [
        "Friend.List",
        0x2d01,
        {
            fields: [
                {
                    name: "friends",
                    type: "array",
                    fields: [
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "unknown2", type: "uint32", defaultValue: 0 },
                        { name: "unknown3", type: "uint32", defaultValue: 0 },
                        { name: "characterName", type: "string", defaultValue: "" },
                        { name: "unknown4", type: "uint32", defaultValue: 0 },
                        { name: "characterId", type: "uint64", defaultValue: "0" },
                        {
                            name: "is_online_data",
                            type: "variabletype8",
                            types: {
                                0: [
                                    { name: "unknown5", type: "uint32", defaultValue: 0 },
                                    { name: "unknown6", type: "uint32", defaultValue: 0 },
                                ],
                                1: [
                                    { name: "unknown5", type: "uint32", defaultValue: 0 },
                                    { name: "unknown6", type: "uint32", defaultValue: 0 },
                                    { name: "unknown7", type: "uint32", defaultValue: 0 },
                                    { name: "unknown8", type: "uint32", defaultValue: 0 },
                                    { name: "unknown9", type: "uint8", defaultValue: 0 },
                                    { name: "location_x", type: "float", defaultValue: 0.0 },
                                    { name: "location_y", type: "float", defaultValue: 0.0 },
                                    { name: "unknown10", type: "uint32", defaultValue: 0 },
                                    { name: "unknown11", type: "uint32", defaultValue: 0 },
                                    { name: "unknown12", type: "uint32", defaultValue: 0 },
                                    { name: "unknown13", type: "uint32", defaultValue: 0 },
                                    { name: "unknown14", type: "uint8", defaultValue: 0 },
                                ],
                            },
                        },
                    ],
                },
            ],
        },
    ],
    ["Friend.Online", 0x2d02, { fields: [] }],
    ["Friend.Offline", 0x2d03, { fields: [] }],
    ["Friend.UpdateProfileInfo", 0x2d04, { fields: [] }],
    ["Friend.UpdatePositions", 0x2d05, { fields: [] }],
    ["Friend.Add", 0x2d06, { fields: [] }],
    ["Friend.Remove", 0x2d07, { fields: [] }],
    [
        "Friend.Message",
        0x2d08,
        {
            fields: [
                { name: "messageType", type: "uint8", defaultValue: 0 },
                { name: "messageTime", type: "uint64", defaultValue: "0" },
                {
                    name: "messageData1",
                    type: "schema",
                    fields: [
                        { name: "unknowndDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknowndDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknowndDword3", type: "uint32", defaultValue: 0 },
                        { name: "characterName", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                    ],
                },
                {
                    name: "messageData2",
                    type: "schema",
                    fields: [
                        { name: "unknowndDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknowndDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknowndDword3", type: "uint32", defaultValue: 0 },
                        { name: "characterName", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                    ],
                },
            ],
        },
    ],
    ["Friend.Status", 0x2d09, { fields: [] }],
    ["Friend.Rename", 0x2d0a, { fields: [] }],
    ["Broadcast", 0x2e, { fields: [] }],
    ["ClientKickedFromServer", 0x2f, { fields: [] }],
    [
        "UpdateClientSessionData",
        0x30,
        {
            fields: [
                { name: "sessionId", type: "string", defaultValue: "" },
                { name: "stationName", type: "string", defaultValue: "" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownString2", type: "string", defaultValue: "" },
                { name: "stationCode", type: "string", defaultValue: "" },
                { name: "unknownString3", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["BugSubmission", 0x31, { fields: [] }],
    [
        "WorldDisplayInfo",
        0x32,
        {
            fields: [{ name: "worldId", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["MOTD", 0x33, { fields: [] }],
    [
        "SetLocale",
        0x34,
        {
            fields: [{ name: "locale", type: "string", defaultValue: "" }],
        },
    ],
    ["SetClientArea", 0x35, { fields: [] }],
    ["ZoneTeleportRequest", 0x36, { fields: [] }],
    ["TradingCard", 0x37, { fields: [] }],
    ["WorldShutdownNotice", 0x38, { fields: [] }],
    ["LoadWelcomeScreen", 0x39, { fields: [] }],
    ["ShipCombat", 0x3a, { fields: [] }],
    ["AdminMiniGame", 0x3b, { fields: [] }],
    [
        "KeepAlive",
        0x3c,
        {
            fields: [{ name: "gameTime", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["ClientExitLaunchUrl", 0x3d, { fields: [] }],
    ["ClientPath", 0x3e, { fields: [] }],
    ["ClientPendingKickFromServer", 0x3f, { fields: [] }],
    [
        "MembershipActivation",
        0x40,
        {
            fields: [{ name: "unknown", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["Lobby.JoinLobbyGame", 0x4101, { fields: [] }],
    ["Lobby.LeaveLobbyGame", 0x4102, { fields: [] }],
    ["Lobby.StartLobbyGame", 0x4103, { fields: [] }],
    ["Lobby.UpdateLobbyGame", 0x4104, { fields: [] }],
    ["Lobby.SendLobbyToClient", 0x4106, { fields: [] }],
    ["Lobby.SendLeaveLobbyToClient", 0x4107, { fields: [] }],
    ["Lobby.RemoveLobbyGame", 0x4108, { fields: [] }],
    ["Lobby.LobbyErrorMessage", 0x410b, { fields: [] }],
    ["Lobby.ShowLobbyUi", 0x410c, { fields: [] }],
    [
        "LobbyGameDefinition.DefinitionsRequest",
        0x420100,
        {
            fields: [],
        },
    ],
    [
        "LobbyGameDefinition.DefinitionsResponse",
        0x420200,
        {
            fields: [
                {
                    name: "definitionsData",
                    type: "byteswithlength",
                    fields: [{ name: "data", type: "string", defaultValue: "" }],
                },
            ],
        },
    ],
    ["ShowSystemMessage", 0x43, { fields: [] }],
    ["POIChangeMessage", 0x44, { fields: [] }],
    ["ClientMetrics", 0x45, { fields: [] }],
    ["FirstTimeEvent", 0x46, { fields: [] }],
    ["Claim", 0x47, { fields: [] }],
    [
        "ClientLog",
        0x48,
        {
            fields: [
                { name: "file", type: "string", defaultValue: "" },
                { name: "message", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["Ignore", 0x49, { fields: [] }],
    ["SnoopedPlayer", 0x4a, { fields: [] }],
    ["Promotional", 0x4b, { fields: [] }],
    ["AddClientPortraitCrc", 0x4c, { fields: [] }],
    ["ObjectiveTarget", 0x4d, { fields: [] }],
    ["CommerceSessionRequest", 0x4e, { fields: [] }],
    ["CommerceSessionResponse", 0x4f, { fields: [] }],
    ["TrackedEvent", 0x50, { fields: [] }],
    ["LoginFailed", 0x51, { fields: [] }],
    ["LoginToUChat", 0x52, { fields: [] }],
    ["ZoneSafeTeleportRequest", 0x53, { fields: [] }],
    ["RemoteInteractionRequest", 0x54, { fields: [] }],
    ["UpdateCamera", 0x57, { fields: [] }],
    ["Guild.Disband", 0x5802, { fields: [] }],
    ["Guild.Rename", 0x5803, { fields: [] }],
    ["Guild.ChangeMemberRank", 0x580a, { fields: [] }],
    ["Guild.MotdUpdate", 0x580b, { fields: [] }],
    ["Guild.UpdateRank", 0x580e, { fields: [] }],
    ["Guild.DataFull", 0x580f, { fields: [] }],
    ["Guild.Data", 0x5810, { fields: [] }],
    ["Guild.Invitations", 0x5811, { fields: [] }],
    ["Guild.AddMember", 0x5812, { fields: [] }],
    ["Guild.RemoveMember", 0x5813, { fields: [] }],
    ["Guild.UpdateInvitation", 0x5814, { fields: [] }],
    ["Guild.MemberOnlineStatus", 0x5815, { fields: [] }],
    ["Guild.TagsUpdated", 0x5816, { fields: [] }],
    ["Guild.Notification", 0x5817, { fields: [] }],
    ["Guild.UpdateAppData", 0x5820, { fields: [] }],
    ["Guild.RecruitingGuildsForBrowserReply", 0x5826, { fields: [] }],
    ["AdminGuild", 0x59, { fields: [] }],
    ["BattleMages", 0x5a, { fields: [] }],
    ["WorldToWorld", 0x5b, { fields: [] }],
    ["PerformAction", 0x5c, { fields: [] }],
    ["EncounterMatchmaking", 0x5d, { fields: [] }],
    ["ClientLuaMetrics", 0x5e, { fields: [] }],
    ["RepeatingActivity", 0x5f, { fields: [] }],
    [
        "ClientGameSettings",
        0x60,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "timescale", type: "float", defaultValue: 1.0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    ["ClientTrialProfileUpsell", 0x61, { fields: [] }],
    ["ActivityManager.ProfileActivityList", 0x6201, { fields: [] }],
    ["ActivityManager.JoinErrorString", 0x6202, { fields: [] }],
    ["RequestSendItemDefinitionsToClient", 0x63, { fields: [] }],
    ["Inspect", 0x64, { fields: [] }],
    [
        "Achievement.Add",
        0x6502,
        {
            fields: [
                { name: "achievementId", type: "uint32", defaultValue: 0 },
                {
                    name: "achievementData",
                    type: "schema",
                    fields: objectiveDataSchema,
                },
            ],
        },
    ],
    [
        "Achievement.Initialize",
        0x6503,
        {
            fields: [
                {
                    name: "clientAchievements",
                    type: "array",
                    fields: achievementDataSchema,
                },
                {
                    name: "achievementData",
                    type: "byteswithlength",
                    fields: [
                        {
                            name: "achievements",
                            type: "array",
                            fields: achievementDataSchema,
                        },
                    ],
                },
            ],
        },
    ],
    ["Achievement.Complete", 0x6504, { fields: [] }],
    ["Achievement.ObjectiveAdded", 0x6505, { fields: [] }],
    ["Achievement.ObjectiveActivated", 0x6506, { fields: [] }],
    ["Achievement.ObjectiveUpdate", 0x6507, { fields: [] }],
    ["Achievement.ObjectiveComplete", 0x6508, { fields: [] }],
    [
        "PlayerTitle",
        0x66,
        {
            fields: [
                { name: "unknown1", type: "uint8", defaultValue: 0 },
                { name: "titleId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Fotomat", 0x67, { fields: [] }],
    ["UpdateUserAge", 0x68, { fields: [] }],
    ["Loot", 0x69, { fields: [] }],
    ["ActionBarManager", 0x6a, { fields: [] }],
    ["ClientTrialProfileUpsellRequest", 0x6b, { fields: [] }],
    ["PlayerUpdateJump", 0x6c, { fields: [] }],
    [
        "CoinStore.ItemList",
        0x6d0100,
        {
            fields: [
                {
                    name: "items",
                    type: "array",
                    fields: [
                        { name: "itemId", type: "uint32", defaultValue: 0 },
                        {
                            name: "itemData",
                            type: "schema",
                            fields: [
                                { name: "itemId2", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownBoolean1",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                                {
                                    name: "unknownBoolean2",
                                    type: "boolean",
                                    defaultValue: false,
                                },
                            ],
                        },
                    ],
                },
                { name: "unknown1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["CoinStore.ItemDefinitionsRequest", 0x6d0200, { fields: [] }],
    ["CoinStore.ItemDefinitionsResponse", 0x6d0300, { fields: [] }],
    [
        "CoinStore.SellToClientRequest",
        0x6d0400,
        {
            fields: [
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                { name: "itemId", type: "uint32", defaultValue: 0 },
                { name: "unknown4", type: "uint32", defaultValue: 0 },
                { name: "quantity", type: "uint32", defaultValue: 0 },
                { name: "unknown6", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["CoinStore.BuyFromClientRequest", 0x6d0500, { fields: [] }],
    [
        "CoinStore.TransactionComplete",
        0x6d0600,
        {
            fields: [
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                { name: "unknown3", type: "uint32", defaultValue: 0 },
                { name: "unknown4", type: "uint32", defaultValue: 0 },
                { name: "unknown5", type: "uint32", defaultValue: 0 },
                { name: "unknown6", type: "uint32", defaultValue: 0 },
                { name: "unknown7", type: "uint32", defaultValue: 0 },
                { name: "unknown8", type: "uint32", defaultValue: 0 },
                { name: "timestamp", type: "uint32", defaultValue: 0 },
                { name: "unknown9", type: "uint32", defaultValue: 0 },
                { name: "itemId", type: "uint32", defaultValue: 0 },
                { name: "unknown10", type: "uint32", defaultValue: 0 },
                { name: "quantity", type: "uint32", defaultValue: 0 },
                { name: "unknown11", type: "uint32", defaultValue: 0 },
                { name: "unknown12", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["CoinStore.Open", 0x6d0700, { fields: [] }],
    ["CoinStore.ItemDynamicListUpdateRequest", 0x6d0800, { fields: [] }],
    ["CoinStore.ItemDynamicListUpdateResponse", 0x6d0900, { fields: [] }],
    ["CoinStore.MerchantList", 0x6d0a00, { fields: [] }],
    ["CoinStore.ClearTransactionHistory", 0x6d0b00, { fields: [] }],
    ["CoinStore.BuyBackRequest", 0x6d0c00, { fields: [] }],
    ["CoinStore.BuyBackResponse", 0x6d0d00, { fields: [] }],
    ["CoinStore.SellToClientAndGiftRequest", 0x6d0e00, { fields: [] }],
    ["CoinStore.ReceiveGiftItem", 0x6d1100, { fields: [] }],
    ["CoinStore.GiftTransactionComplete", 0x6d1200, { fields: [] }],
    [
        "InitializationParameters",
        0x6e,
        {
            fields: [
                { name: "environment", type: "string", defaultValue: "" },
                { name: "serverId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["ActivityService.Activity.ListOfActivities", 0x6f0101, { fields: [] }],
    [
        "ActivityService.Activity.UpdateActivityFeaturedStatus",
        0x6f0105,
        { fields: [] },
    ],
    [
        "ActivityService.ScheduledActivity.ListOfActivities",
        0x6f0201,
        { fields: [] },
    ],
    ["Mount.MountRequest", 0x7001, { fields: [] }],
    [
        "Mount.MountResponse",
        0x7002,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                {
                    name: "characterData",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "characterName", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                    ],
                },
                { name: "tagString", type: "string", defaultValue: "" },
                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "Mount.DismountRequest",
        0x7003,
        {
            fields: [{ name: "unknownByte1", type: "uint8", defaultValue: 0 }],
        },
    ],
    [
        "Mount.DismountResponse",
        0x7004,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["Mount.List", 0x7005, { fields: [] }],
    ["Mount.Spawn", 0x7006, { fields: [] }],
    ["Mount.Despawn", 0x7007, { fields: [] }],
    ["Mount.SpawnByItemDefinitionId", 0x7008, { fields: [] }],
    ["Mount.OfferUpsell", 0x7009, { fields: [] }],
    ["Mount.SeatChangeRequest", 0x700a, { fields: [] }],
    ["Mount.SeatChangeResponse", 0x700b, { fields: [] }],
    ["Mount.SeatSwapRequest", 0x700c, { fields: [] }],
    ["Mount.SeatSwapResponse", 0x700d, { fields: [] }],
    ["Mount.TypeCount", 0x700e, { fields: [] }],
    [
        "ClientInitializationDetails",
        0x71,
        {
            fields: [{ name: "unknownDword1", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["ClientAreaTimer", 0x72, { fields: [] }],
    ["LoyaltyReward.GiveLoyaltyReward", 0x7301, { fields: [] }],
    ["Rating", 0x74, { fields: [] }],
    ["ClientActivityLaunch", 0x75, { fields: [] }],
    ["ServerActivityLaunch", 0x76, { fields: [] }],
    ["ClientFlashTimer", 0x77, { fields: [] }],
    [
        "PlayerUpdate.UpdatePosition",
        0x78,
        {
            fields: [{ name: "unknown1", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["InviteAndStartMiniGame", 0x79, { fields: [] }],
    ["PlayerUpdate.Flourish", 0x7a, { fields: [] }],
    ["Quiz", 0x7b, { fields: [] }],
    ["PlayerUpdate.PositionOnPlatform", 0x7c, { fields: [] }],
    ["ClientMembershipVipInfo", 0x7d, { fields: [] }],
    ["Target", 0x7e, { fields: [] }],
    ["GuideStone", 0x7f, { fields: [] }],
    ["Raid", 0x80, { fields: [] }],
    [
        "Voice.Login",
        0x8100,
        {
            fields: [
                { name: "clientName", type: "string", defaultValue: "" },
                { name: "sessionId", type: "string", defaultValue: "" },
                { name: "url", type: "string", defaultValue: "" },
                { name: "characterName", type: "string", defaultValue: "" },
            ],
        },
    ],
    [
        "Voice.JoinChannel",
        0x8101,
        {
            fields: [
                { name: "roomType", type: "uint8", defaultValue: 0 },
                { name: "uri", type: "string", defaultValue: "" },
                { name: "unknown1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Voice.LeaveChannel", 0x8102, { fields: [] }],
    [
        "Weapon.Weapon",
        0x8200,
        {
            fields: [
                {
                    name: "weaponPacket",
                    type: "custom",
                    parser: parseWeaponPacket,
                    packer: packWeaponPacket,
                },
            ],
        },
    ],
    [
        "Facility.ReferenceData",
        0x8401,
        {
            fields: [{ name: "data", type: "byteswithlength" }],
        },
    ],
    [
        "Facility.FacilityData",
        0x8402,
        {
            fields: [
                {
                    name: "facilities",
                    type: "array",
                    fields: [
                        { name: "facilityId", type: "uint32", defaultValue: 0 },
                        { name: "facilityType", type: "uint8", defaultValue: 0 },
                        { name: "unknown2_uint8", type: "uint8", defaultValue: 0 },
                        { name: "regionId", type: "uint32", defaultValue: 0 },
                        { name: "nameId", type: "uint32", defaultValue: 0 },
                        { name: "locationX", type: "float", defaultValue: 0.0 },
                        { name: "locationY", type: "float", defaultValue: 0.0 },
                        { name: "locationZ", type: "float", defaultValue: 0.0 },
                        { name: "unknown3_float", type: "float", defaultValue: 0.0 },
                        { name: "imageSetId", type: "uint32", defaultValue: 0 },
                        { name: "unknown5_uint32", type: "uint32", defaultValue: 0 },
                        { name: "unknown6_uint8", type: "uint8", defaultValue: 0 },
                        { name: "unknown7_uint8", type: "uint8", defaultValue: 0 },
                        { name: "unknown8_bytes", type: "bytes", length: 36 },
                    ],
                },
            ],
        },
    ],
    ["Facility.CurrentFacilityUpdate", 0x8403, { fields: [] }],
    ["Facility.SpawnDataRequest", 0x8404, { fields: [] }],
    ["Facility.FacilitySpawnData", 0x8405, { fields: [] }],
    [
        "Facility.FacilityUpdate",
        0x8406,
        {
            fn: function (data, offset) {
                var result = {}, startOffset = offset, n, i, values, flags;
                result["facilityId"] = data.readUInt32LE(offset);
                flags = data.readUInt16LE(offset + 4);
                result["flags"] = flags;
                offset += 6;
                if (flags & 1) {
                    result["unknown1"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 1) & 1) {
                    n = data.readUInt32LE(offset);
                    values = [];
                    for (i = 0; i < n; i++) {
                        values[i] = data.readUInt8(offset + 4 + i);
                    }
                    result["unknown2"] = values;
                    offset += 4 + n;
                }
                if ((flags >> 2) & 1) {
                    result["unknown3"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 3) & 1) {
                    n = data.readUInt32LE(offset);
                    values = [];
                    for (i = 0; i < n; i++) {
                        values[i] = data.readUInt8(offset + 4 + i);
                    }
                    result["unknown4"] = values;
                    offset += 4 + n;
                }
                if ((flags >> 4) & 1) {
                    n = data.readUInt32LE(offset);
                    values = [];
                    for (i = 0; i < n; i++) {
                        values[i] = data.readUInt8(offset + 4 + i);
                    }
                    result["unknown5"] = values;
                    offset += 4 + n;
                }
                if ((flags >> 5) & 1) {
                    values = [];
                    for (i = 0; i < 4; i++) {
                        values[i] = data.readUInt8(offset + i);
                    }
                    result["unknown6"] = values;
                    offset += 4;
                }
                if ((flags >> 6) & 1) {
                    result["unknown7"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 8) & 1) {
                    result["unknown8"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 10) & 1) {
                    result["unknown9"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 11) & 1) {
                    result["unknown10"] = [
                        data.readUInt32LE(offset),
                        data.readUInt32LE(offset + 4),
                    ];
                    offset += 8;
                }
                if ((flags >> 12) & 1) {
                    result["unknown11"] = data.readUInt8(offset);
                    offset += 1;
                }
                if ((flags >> 13) & 1) {
                    result["unknown12"] = data.readUInt32LE(offset);
                    offset += 4;
                }
                return {
                    result: result,
                    length: offset - startOffset,
                };
            },
        },
    ],
    ["Facility.FacilitySpawnStatus", 0x8407, { fields: [] }],
    ["Facility.FacilitySpawnStatusTracked", 0x8408, { fields: [] }],
    ["Facility.NotificationFacilityCaptured", 0x8409, { fields: [] }],
    [
        "Facility.NotificationFacilitySignificantCaptureProgress",
        0x840a,
        { fields: [] },
    ],
    ["Facility.NotificationFacilityCloseToCapture", 0x840b, { fields: [] }],
    ["Facility.NotificationFacilitySpawnBeginCapture", 0x840c, { fields: [] }],
    ["Facility.NotificationFacilitySpawnFinishCapture", 0x840d, { fields: [] }],
    [
        "Facility.NotificationLeavingFacilityDuringContention",
        0x840e,
        { fields: [] },
    ],
    ["Facility.ProximitySpawnCaptureUpdate", 0x840f, { fields: [] }],
    ["Facility.ClearProximitySpawn", 0x8410, { fields: [] }],
    ["Facility.GridStabilizeTimerUpdated", 0x8411, { fields: [] }],
    [
        "Facility.SpawnCollisionChanged",
        0x8412,
        {
            fields: [
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "boolean", defaultValue: false },
                { name: "unknown3", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "Facility.NotificationFacilitySecondaryObjectiveEventPacket",
        0x8413,
        { fields: [] },
    ],
    ["Facility.PenetrateShieldEffect", 0x8414, { fields: [] }],
    ["Facility.SpawnUpdateGuid", 0x8415, { fields: [] }],
    ["Facility.FacilityUpdateRequest", 0x8416, { fields: [] }],
    ["Facility.EmpireScoreValueUpdate", 0x8417, { fields: [] }],
    ["Skill.Echo", 0x8501, { fields: [] }],
    ["Skill.SelectSkillSet", 0x8502, { fields: [] }],
    ["Skill.SelectSkill", 0x8503, { fields: [] }],
    ["Skill.GetSkillPointManager", 0x8504, { fields: [] }],
    ["Skill.SetLoyaltyPoints", 0x8505, { fields: [] }],
    ["Skill.LoadSkillDefinitionManager", 0x8506, { fields: [] }],
    ["Skill.SetSkillPointManager", 0x8507, { fields: [] }],
    [
        "Skill.SetSkillPointProgress",
        0x8508,
        {
            fields: [
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "float", defaultValue: 0.0 },
                { name: "unknown3", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    ["Skill.AddSkill", 0x8509, { fields: [] }],
    ["Skill.ReportSkillGrant", 0x850a, { fields: [] }],
    ["Skill.ReportOfflineEarnedSkillPoints", 0x850b, { fields: [] }],
    ["Skill.ReportDeprecatedSkillLine", 0x850c, { fields: [] }],
    ["Loadout.LoadLoadoutDefinitionManager", 0x8601, { fields: [] }],
    ["Loadout.SelectLoadout", 0x8602, { fields: [] }],
    [
        "Loadout.SetCurrentLoadout",
        0x8603,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "loadoutId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "Loadout.SelectSlot",
        0x8604,
        {
            fields: [
                { name: "type", type: "uint8", defaultValue: 0 },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                { name: "loadoutSlotId", type: "uint32", defaultValue: 0 },
                { name: "gameTime", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Loadout.SelectClientSlot", 0x8605, { fields: [] }],
    [
        "Loadout.SetCurrentSlot",
        0x8606,
        {
            fields: [
                { name: "type", type: "uint8", defaultValue: 0 },
                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                { name: "slotId", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Loadout.CreateCustomLoadout", 0x8607, { fields: [] }],
    ["Loadout.SelectSlotItem", 0x8608, { fields: [] }],
    ["Loadout.UnselectSlotItem", 0x8609, { fields: [] }],
    ["Loadout.SelectSlotTintItem", 0x860a, { fields: [] }],
    ["Loadout.UnselectSlotTintItem", 0x860b, { fields: [] }],
    ["Loadout.SelectAllSlotTintItems", 0x860c, { fields: [] }],
    ["Loadout.UnselectAllSlotTintItems", 0x860d, { fields: [] }],
    ["Loadout.SelectBodyTintItem", 0x860e, { fields: [] }],
    ["Loadout.UnselectBodyTintItem", 0x860f, { fields: [] }],
    ["Loadout.SelectAllBodyTintItems", 0x8610, { fields: [] }],
    ["Loadout.UnselectAllBodyTintItems", 0x8611, { fields: [] }],
    ["Loadout.SelectGuildTintItem", 0x8612, { fields: [] }],
    ["Loadout.UnselectGuildTintItem", 0x8613, { fields: [] }],
    ["Loadout.SelectDecalItem", 0x8614, { fields: [] }],
    ["Loadout.UnselectDecalItem", 0x8615, { fields: [] }],
    ["Loadout.SelectAttachmentItem", 0x8616, { fields: [] }],
    ["Loadout.UnselectAttachmentItem", 0x8617, { fields: [] }],
    ["Loadout.SelectCustomName", 0x8618, { fields: [] }],
    ["Loadout.ActivateLoadoutTerminal", 0x8619, { fields: [] }],
    [
        "Loadout.ActivateVehicleLoadoutTerminal",
        0x861a,
        {
            fields: [
                { name: "type", type: "uint8", defaultValue: 0 },
                { name: "guid", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "Loadout.SetLoadouts",
        0x861b,
        {
            fields: [
                { name: "type", type: "uint8", defaultValue: 0 },
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Loadout.AddLoadout", 0x861c, { fields: [] }],
    ["Loadout.UpdateCurrentLoadout", 0x861d, { fields: [] }],
    ["Loadout.UpdateLoadoutSlot", 0x861e, { fields: [] }],
    ["Loadout.SetVehicleLoadouts", 0x861f, { fields: [] }],
    ["Loadout.AddVehicleLoadout", 0x8620, { fields: [] }],
    ["Loadout.ClearCurrentVehicleLoadout", 0x8621, { fields: [] }],
    ["Loadout.UpdateVehicleLoadoutSlot", 0x8622, { fields: [] }],
    ["Loadout.SetSlotTintItem", 0x8623, { fields: [] }],
    ["Loadout.UnsetSlotTintItem", 0x8624, { fields: [] }],
    ["Loadout.SetBodyTintItem", 0x8625, { fields: [] }],
    ["Loadout.UnsetBodyTintItem", 0x8626, { fields: [] }],
    ["Loadout.SetGuildTintItem", 0x8627, { fields: [] }],
    ["Loadout.UnsetGuildTintItem", 0x8628, { fields: [] }],
    ["Loadout.SetDecalItem", 0x8629, { fields: [] }],
    ["Loadout.UnsetDecalItem", 0x862a, { fields: [] }],
    ["Loadout.SetCustomName", 0x862b, { fields: [] }],
    ["Loadout.UnsetCustomName", 0x862c, { fields: [] }],
    ["Loadout.UpdateLoadoutSlotItemLineConfig", 0x862d, { fields: [] }],
    ["Experience.SetExperience", 0x8701, { fields: [] }],
    [
        "Experience.SetExperienceRanks",
        0x8702,
        {
            fields: [
                {
                    name: "experienceRanks",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        {
                            name: "experienceRankData",
                            type: "array",
                            fields: [
                                { name: "experienceRequired", type: "uint32", defaultValue: 0 },
                                {
                                    name: "factionRanks",
                                    type: "array",
                                    length: 4,
                                    fields: [
                                        { name: "nameId", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "imageSetId", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "rewards",
                                            type: "array",
                                            fields: [
                                                { name: "itemId", type: "uint32", defaultValue: 0 },
                                                { name: "nameId", type: "uint32", defaultValue: 0 },
                                                { name: "imageSetId", type: "uint32", defaultValue: 0 },
                                                {
                                                    name: "itemCountMin",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "itemCountMax",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                { name: "itemType", type: "uint32", defaultValue: 0 },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    [
        "Experience.SetExperienceRateTier",
        0x8703,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                { name: "unknownDword5", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    [
        "Vehicle.Owner",
        0x8801,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "vehicleId", type: "uint32", defaultValue: 0 },
                {
                    name: "passengers",
                    type: "array",
                    fields: [
                        {
                            name: "passengerData",
                            type: "schema",
                            fields: [
                                { name: "characterId", type: "uint64", defaultValue: "0" },
                                {
                                    name: "characterData",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "characterName", type: "string", defaultValue: "" },
                                        {
                                            name: "unknownString1",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                            ],
                        },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    [
        "Vehicle.Occupy",
        0x8802,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "vehicleId", type: "uint32", defaultValue: 0 },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                {
                    name: "unknownArray1",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                    ],
                },
                {
                    name: "passengers",
                    type: "array",
                    fields: [
                        {
                            name: "passengerData",
                            type: "schema",
                            fields: [
                                { name: "characterId", type: "uint64", defaultValue: "0" },
                                {
                                    name: "characterData",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                        { name: "characterName", type: "string", defaultValue: "" },
                                        {
                                            name: "unknownString1",
                                            type: "string",
                                            defaultValue: "",
                                        },
                                    ],
                                },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                            ],
                        },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknownArray2",
                    type: "array",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword5", type: "uint32", defaultValue: 0 },
                        {
                            name: "unknownArray3",
                            type: "array",
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                {
                                    name: "unknownData1",
                                    type: "schema",
                                    fields: [
                                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                        {
                                            name: "unknownData1",
                                            type: "schema",
                                            fields: [
                                                {
                                                    name: "unknownDword1",
                                                    type: "uint32",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownByte1",
                                                    type: "uint8",
                                                    defaultValue: 0,
                                                },
                                                {
                                                    name: "unknownArray1",
                                                    type: "array",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                                {
                                                    name: "unknownArray2",
                                                    type: "array",
                                                    fields: [
                                                        {
                                                            name: "unknownDword1",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                        {
                                                            name: "unknownDword2",
                                                            type: "uint32",
                                                            defaultValue: 0,
                                                        },
                                                    ],
                                                },
                                            ],
                                        },
                                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    name: "unknownBytes1",
                    type: "byteswithlength",
                    defaultValue: null,
                    fields: [
                        {
                            name: "itemData",
                            type: "custom",
                            parser: parseItemData,
                            packer: packItemData,
                        },
                    ],
                },
                { name: "unknownBytes2", type: "byteswithlength", defaultValue: null },
            ],
        },
    ],
    [
        "Vehicle.StateData",
        0x8803,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknown3", type: "float", defaultValue: 0.0 },
                {
                    name: "unknown4",
                    type: "array",
                    fields: [
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "unknown2", type: "uint8", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknown5",
                    type: "array",
                    fields: [
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "unknown2", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["Vehicle.StateDamage", 0x8804, { fields: [] }],
    ["Vehicle.PlayerManager", 0x8805, { fields: [] }],
    [
        "Vehicle.Spawn",
        0x8806,
        {
            fields: [
                { name: "vehicleId", type: "uint32", defaultValue: 0 },
                { name: "loadoutTab", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Vehicle.Tint", 0x8807, { fields: [] }],
    ["Vehicle.LoadVehicleTerminalDefinitionManager", 0x8808, { fields: [] }],
    ["Vehicle.ActiveWeapon", 0x8809, { fields: [] }],
    ["Vehicle.Stats", 0x880a, { fields: [] }],
    ["Vehicle.DamageInfo", 0x880b, { fields: [] }],
    ["Vehicle.StatUpdate", 0x880c, { fields: [] }],
    ["Vehicle.UpdateWeapon", 0x880d, { fields: [] }],
    ["Vehicle.RemovedFromQueue", 0x880e, { fields: [] }],
    [
        "Vehicle.UpdateQueuePosition",
        0x880f,
        {
            fields: [{ name: "queuePosition", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["Vehicle.PadDestroyNotify", 0x8810, { fields: [] }],
    [
        "Vehicle.SetAutoDrive",
        0x8811,
        {
            fields: [{ name: "guid", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["Vehicle.LockOnInfo", 0x8812, { fields: [] }],
    ["Vehicle.LockOnState", 0x8813, { fields: [] }],
    ["Vehicle.TrackingState", 0x8814, { fields: [] }],
    ["Vehicle.CounterMeasureState", 0x8815, { fields: [] }],
    [
        "Vehicle.LoadVehicleDefinitionManager",
        0x8816,
        {
            fields: [
                {
                    name: "vehicleDefinitions",
                    type: "array",
                    fields: [
                        { name: "vehicleId", type: "uint32", defaultValue: 0 },
                        { name: "modelId", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["Vehicle.AcquireState", 0x8817, { fields: [] }],
    ["Vehicle.Dismiss", 0x8818, { fields: [] }],
    [
        "Vehicle.AutoMount",
        0x8819,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Vehicle.Deploy", 0x881a, { fields: [] }],
    ["Vehicle.Engine", 0x881b, { fields: [] }],
    ["Vehicle.AccessType", 0x881c, { fields: [] }],
    ["Vehicle.KickPlayer", 0x881d, { fields: [] }],
    ["Vehicle.HealthUpdateOwner", 0x881e, { fields: [] }],
    ["Vehicle.OwnerPassengerList", 0x881f, { fields: [] }],
    ["Vehicle.Kick", 0x8820, { fields: [] }],
    ["Vehicle.NoAccess", 0x8821, { fields: [] }],
    [
        "Vehicle.Expiration",
        0x8822,
        {
            fields: [{ name: "expireTime", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["Vehicle.Group", 0x8823, { fields: [] }],
    ["Vehicle.DeployResponse", 0x8824, { fields: [] }],
    ["Vehicle.ExitPoints", 0x8825, { fields: [] }],
    ["Vehicle.ControllerLogOut", 0x8826, { fields: [] }],
    ["Vehicle.CurrentMoveMode", 0x8827, { fields: [] }],
    ["Vehicle.ItemDefinitionRequest", 0x8828, { fields: [] }],
    ["Vehicle.ItemDefinitionReply", 0x8829, { fields: [] }],
    ["Vehicle.InventoryItems", 0x882a, { fields: [] }],
    ["Grief", 0x89, { fields: [] }],
    ["SpotPlayer", 0x8a, { fields: [] }],
    ["Faction", 0x8b, { fields: [] }],
    [
        "Synchronization",
        0x8c,
        {
            fields: [
                { name: "time1", type: "uint64", defaultValue: "0" },
                { name: "time2", type: "uint64", defaultValue: "0" },
                { name: "clientTime", type: "uint64", defaultValue: "0" },
                { name: "serverTime", type: "uint64", defaultValue: "0" },
                { name: "serverTime2", type: "uint64", defaultValue: "0" },
                { name: "time3", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "ResourceEvent",
        0x8d00,
        {
            fields: [
                { name: "gameTime", type: "uint32", defaultValue: 0 },
                {
                    name: "eventData",
                    type: "variabletype8",
                    types: {
                        1: [
                            // SetCharacterResources
                            { name: "characterId", type: "uint64", defaultValue: "0" },
                            {
                                name: "unknownArray1",
                                type: "array",
                                fields: [
                                    { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                    {
                                        name: "unknownData1",
                                        type: "schema",
                                        fields: resourceEventDataSubSchema,
                                    },
                                ],
                            },
                        ],
                        2: [
                            // SetCharacterResource
                            { name: "characterId", type: "uint64", defaultValue: "0" },
                            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            {
                                name: "unknownArray1",
                                type: "array",
                                fields: [
                                    { name: "unknownDword1", type: "float", defaultValue: 0.0 },
                                    { name: "unknownDword2", type: "float", defaultValue: 0.0 },
                                    { name: "unknownDword3", type: "float", defaultValue: 0.0 },
                                    { name: "unknownDword4", type: "float", defaultValue: 0.0 },
                                ],
                            },
                            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                            { name: "unknownFloat5", type: "float", defaultValue: 0.0 },
                            { name: "unknownFloat6", type: "float", defaultValue: 0.0 },
                            { name: "unknownFloat7", type: "float", defaultValue: 0.0 },
                            { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                            { name: "unknownGuid3", type: "uint64", defaultValue: "0" },
                            { name: "unknownGuid4", type: "uint64", defaultValue: "0" },
                            { name: "unknownGuid5", type: "uint64", defaultValue: "0" },
                        ],
                        3: [
                            // UpdateCharacterResource
                            { name: "characterId", type: "uint64", defaultValue: "0" },
                            { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                            { name: "unknownFloat5", type: "float", defaultValue: 0.0 },
                            { name: "unknownFloat6", type: "float", defaultValue: 0.0 },
                            { name: "unknownFloat7", type: "float", defaultValue: 0.0 },
                            { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                            { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                            { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                            { name: "unknownByte2", type: "uint8", defaultValue: 0 },
                            { name: "unknownGuid3", type: "uint64", defaultValue: "0" },
                            { name: "unknownGuid4", type: "uint64", defaultValue: "0" },
                            { name: "unknownGuid5", type: "uint64", defaultValue: "0" },
                            { name: "unknownBoolean", type: "boolean", defaultValue: false },
                        ],
                        4: [
                        // RemoveCharacterResource
                        ],
                    },
                },
            ],
        },
    ],
    [
        "Collision.Damage",
        0x8e01,
        {
            fields: [
                { name: "guid", type: "uint64", defaultValue: "0" },
                { name: "unknownBoolean1", type: "boolean", defaultValue: false },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["Leaderboard", 0x8f, { fields: [] }],
    ["PlayerUpdateManagedPosition", 0x90, { fields: [] }],
    ["PlayerUpdateNetworkObjectComponents", 0x91, { fields: [] }],
    ["PlayerUpdateUpdateVehicleWeapon", 0x92, { fields: [] }],
    [
        "ProfileStats.GetPlayerProfileStats",
        0x930000,
        {
            fields: [{ name: "characterId", type: "uint64", defaultValue: "0" }],
        },
    ],
    ["ProfileStats.GetZonePlayerProfileStats", 0x930100, { fields: [] }],
    [
        "ProfileStats.PlayerProfileStats",
        0x930200,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: profileStatsSubSchema1,
                        },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownArray1", type: "array", elementType: "uint32" },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "characterName", type: "string", defaultValue: "" },
                        { name: "characterId", type: "uint64", defaultValue: "0" },
                        { name: "battleRank", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword4", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword6", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword7", type: "uint32", defaultValue: 0 },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                        { name: "unknownArray2", type: "array", elementType: "uint32" },
                        { name: "unknownDword8", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword9", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword10", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword11", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword12", type: "uint32", defaultValue: 0 },
                        { name: "unknownArray3", type: "array", elementType: "uint32" },
                        { name: "unknownDword13", type: "uint32", defaultValue: 0 },
                        { name: "unknownArray4", type: "array", elementType: "uint32" },
                        {
                            name: "unknownArray5",
                            type: "array",
                            length: 10,
                            fields: [
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownArray1", type: "array", elementType: "uint32" },
                                { name: "unknownArray2", type: "array", elementType: "uint32" },
                                { name: "unknownArray3", type: "array", elementType: "uint32" },
                            ],
                        },
                    ],
                },
                { name: "weaponStats1", type: "array", fields: weaponStatsDataSchema },
                { name: "weaponStats2", type: "array", fields: weaponStatsDataSchema },
                { name: "vehicleStats", type: "array", fields: vehicleStatsDataSchema },
                {
                    name: "facilityStats1",
                    type: "array",
                    fields: facilityStatsDataSchema,
                },
                {
                    name: "facilityStats2",
                    type: "array",
                    fields: facilityStatsDataSchema,
                },
            ],
        },
    ],
    ["ProfileStats.ZonePlayerProfileStats", 0x930300, { fields: [] }],
    ["ProfileStats.UpdatePlayerLeaderboards", 0x930400, { fields: [] }],
    ["ProfileStats.UpdatePlayerLeaderboardsReply", 0x930500, { fields: [] }],
    ["ProfileStats.GetLeaderboard", 0x930600, { fields: [] }],
    ["ProfileStats.Leaderboard", 0x930700, { fields: [] }],
    ["ProfileStats.GetZoneCharacterStats", 0x930800, { fields: [] }],
    ["ProfileStats.ZoneCharacterStats", 0x930900, { fields: [] }],
    [
        "Equipment.SetCharacterEquipment",
        0x9401,
        {
            fields: [
                { name: "profileId", type: "uint32", defaultValue: 0 },
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownString1", type: "string", defaultValue: "" },
                { name: "unknownString2", type: "string", defaultValue: "" },
                {
                    name: "equipmentSlots",
                    type: "array",
                    fields: [
                        { name: "equipmentSlotId", type: "uint32", defaultValue: 0 },
                        {
                            name: "equipmentSlotData",
                            type: "schema",
                            fields: [
                                { name: "equipmentSlotId", type: "uint32", defaultValue: 0 },
                                { name: "guid", type: "uint64", defaultValue: "0" },
                                { name: "unknownString1", type: "string", defaultValue: "" },
                                { name: "unknownString2", type: "string", defaultValue: "" },
                            ],
                        },
                    ],
                },
                {
                    name: "attachmentData",
                    type: "array",
                    fields: [
                        { name: "modelName", type: "string", defaultValue: "" },
                        { name: "unknownString1", type: "string", defaultValue: "" },
                        { name: "tintAlias", type: "string", defaultValue: "" },
                        { name: "unknownString2", type: "string", defaultValue: "" },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "slotId", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["Equipment.SetCharacterEquipmentSlot", 0x9402, { fields: [] }],
    ["Equipment.UnsetCharacterEquipmentSlot", 0x9403, { fields: [] }],
    [
        "Equipment.SetCharacterEquipmentSlots",
        0x9404,
        {
            fields: [
                { name: "profileId", type: "uint32", defaultValue: 0 },
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "gameTime", type: "uint32", defaultValue: 0 },
                {
                    name: "slots",
                    type: "array",
                    fields: [
                        { name: "index", type: "uint32", defaultValue: 0 },
                        { name: "slotId", type: "uint32", defaultValue: 0 },
                    ],
                },
                { name: "unknown1", type: "uint32", defaultValue: 0 },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                { name: "unknown3", type: "uint32", defaultValue: 0 },
                {
                    name: "textures",
                    type: "array",
                    fields: [
                        { name: "index", type: "uint32", defaultValue: 0 },
                        { name: "slotId", type: "uint32", defaultValue: 0 },
                        { name: "itemId", type: "uint32", defaultValue: 0 },
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "textureAlias", type: "string", defaultValue: "" },
                        { name: "unknown2", type: "string", defaultValue: "" },
                    ],
                },
                {
                    name: "models",
                    type: "array",
                    fields: [
                        { name: "modelName", type: "string", defaultValue: "" },
                        { name: "unknown1", type: "string", defaultValue: "" },
                        { name: "textureAlias", type: "string", defaultValue: "" },
                        { name: "unknown3", type: "string", defaultValue: "" },
                        { name: "unknown4", type: "uint32", defaultValue: 0 },
                        { name: "unknown5", type: "uint32", defaultValue: 0 },
                        { name: "slotId", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["DefinitionFilter.ListDefinitionVariables", 0x9501, { fields: [] }],
    [
        "DefinitionFilter.SetDefinitionVariable",
        0x9502,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                        { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                    ],
                },
            ],
        },
    ],
    [
        "DefinitionFilter.SetDefinitionIntSet",
        0x9503,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                {
                    name: "unknownData1",
                    type: "array",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    [
        "DefinitionFilter.UnknownWithVariable1",
        0x9504,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "DefinitionFilter.UnknownWithVariable2",
        0x9505,
        {
            fields: [
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
            ],
        },
    ],
    [
        "ContinentBattleInfo",
        0x96,
        {
            fields: [
                {
                    name: "zones",
                    type: "array",
                    fields: [
                        { name: "id", type: "uint32", defaultValue: 0 },
                        { name: "nameId", type: "uint32", defaultValue: 0 },
                        { name: "descriptionId", type: "uint32", defaultValue: 0 },
                        { name: "population", type: "array", elementType: "uint8" },
                        { name: "regionPercent", type: "array", elementType: "uint8" },
                        { name: "populationBuff", type: "array", elementType: "uint8" },
                        {
                            name: "populationTargetPercent",
                            type: "array",
                            elementType: "uint8",
                        },
                        { name: "name", type: "string", defaultValue: "" },
                        { name: "hexSize", type: "float", defaultValue: 0.0 },
                        { name: "isProductionZone", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    [
        "GetContinentBattleInfo",
        0x97,
        {
            fields: [],
        },
    ],
    [
        "GetRespawnLocations",
        0x98,
        {
            fields: [],
        },
    ],
    ["WallOfData.PlayerKeyboard", 0x9903, { fields: [] }],
    [
        "WallOfData.UIEvent",
        0x9905,
        {
            fields: [
                { name: "object", type: "string", defaultValue: "" },
                { name: "function", type: "string", defaultValue: "" },
                { name: "argument", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["WallOfData.ClientSystemInfo", 0x9906, { fields: [] }],
    ["WallOfData.VoiceChatEvent", 0x9907, { fields: [] }],
    ["WallOfData.NudgeEvent", 0x9909, { fields: [] }],
    ["WallOfData.LaunchPadFingerprint", 0x990a, { fields: [] }],
    ["WallOfData.VideoCapture", 0x990b, { fields: [] }],
    [
        "WallOfData.ClientTransition",
        0x990c,
        {
            fields: [
                { name: "oldState", type: "uint32", defaultValue: 0 },
                { name: "newState", type: "uint32", defaultValue: 0 },
                { name: "msElapsed", type: "uint32", defaultValue: 0 },
            ],
        },
    ],
    ["ThrustPad.Data", 0x9a01, { fields: [] }],
    ["ThrustPad.Update", 0x9a02, { fields: [] }],
    ["ThrustPad.PlayerEntered", 0x9a03, { fields: [] }],
    ["Implant.SelectImplant", 0x9b01, { fields: [] }],
    ["Implant.UnselectImplant", 0x9b02, { fields: [] }],
    ["Implant.LoadImplantDefinitionManager", 0x9b03, { fields: [] }],
    ["Implant.SetImplants", 0x9b04, { fields: [] }],
    ["Implant.UpdateImplantSlot", 0x9b05, { fields: [] }],
    ["ClientInGamePurchase", 0x9c, { fields: [] }],
    ["Missions.ListMissions", 0x9d01, { fields: [] }],
    ["Missions.ConquerZone", 0x9d02, { fields: [] }],
    ["Missions.SelectMission", 0x9d03, { fields: [] }],
    ["Missions.UnselectMission", 0x9d04, { fields: [] }],
    ["Missions.SetMissionInstanceManager", 0x9d05, { fields: [] }],
    ["Missions.SetMissionManager", 0x9d06, { fields: [] }],
    ["Missions.AddGlobalAvailableMission", 0x9d07, { fields: [] }],
    ["Missions.RemoveGlobalAvailableMission", 0x9d08, { fields: [] }],
    ["Missions.AddAvailableMission", 0x9d09, { fields: [] }],
    ["Missions.RemoveAvailableMission", 0x9d0a, { fields: [] }],
    ["Missions.AddActiveMission", 0x9d0b, { fields: [] }],
    ["Missions.RemoveActiveMission", 0x9d0c, { fields: [] }],
    ["Missions.ReportCompletedMission", 0x9d0d, { fields: [] }],
    ["Missions.AddAvailableMissions", 0x9d0e, { fields: [] }],
    ["Missions.SetMissionChangeList", 0x9d0f, { fields: [] }],
    ["Missions.SetConqueredZone", 0x9d10, { fields: [] }],
    ["Missions.UnsetConqueredZone", 0x9d11, { fields: [] }],
    ["Missions.SetConqueredZones", 0x9d12, { fields: [] }],
    [
        "Effect.AddEffect",
        0x9e01,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknownData2",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        { name: "unknownQword2", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownData3",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        { name: "unknownQword2", type: "uint64", defaultValue: "0" },
                        {
                            name: "unknownVector1",
                            type: "floatvector4",
                            defaultValue: [0, 0, 0, 0],
                        },
                    ],
                },
            ],
        },
    ],
    [
        "Effect.UpdateEffect",
        0x9e02,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknownData2",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownData3",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        { name: "unknownQword2", type: "uint64", defaultValue: "0" },
                        {
                            name: "unknownVector1",
                            type: "floatvector4",
                            defaultValue: [0, 0, 0, 0],
                        },
                    ],
                },
            ],
        },
    ],
    [
        "Effect.RemoveEffect",
        0x9e03,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                        { name: "unknownDword3", type: "uint32", defaultValue: 0 },
                    ],
                },
                {
                    name: "unknownData2",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownData3",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        { name: "unknownQword2", type: "uint64", defaultValue: "0" },
                        {
                            name: "unknownVector1",
                            type: "floatvector4",
                            defaultValue: [0, 0, 0, 0],
                        },
                    ],
                },
            ],
        },
    ],
    [
        "Effect.AddEffectTag",
        0x9e04,
        {
            fields: effectTagDataSchema,
        },
    ],
    [
        "Effect.RemoveEffectTag",
        0x9e05,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
                {
                    name: "unknownData2",
                    type: "schema",
                    fields: [
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        { name: "unknownQword2", type: "uint64", defaultValue: "0" },
                    ],
                },
            ],
        },
    ],
    [
        "Effect.TargetBlockedEffect",
        0x9e06,
        {
            fields: [
                {
                    name: "unknownData1",
                    type: "schema",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                    ],
                },
            ],
        },
    ],
    ["RewardBuffs.ReceivedBundlePacket", 0x9f01, { fields: [] }],
    ["RewardBuffs.NonBundledItem", 0x9f02, { fields: [] }],
    ["RewardBuffs.AddBonus", 0x9f03, { fields: [] }],
    ["RewardBuffs.RemoveBonus", 0x9f04, { fields: [] }],
    ["RewardBuffs.GiveRewardToPlayer", 0x9f05, { fields: [] }],
    ["Abilities.InitAbility", 0xa001, { fields: [] }],
    ["Abilities.UpdateAbility", 0xa002, { fields: [] }],
    ["Abilities.UninitAbility", 0xa003, { fields: [] }],
    ["Abilities.SetAbilityActivationManager", 0xa004, { fields: [] }],
    [
        "Abilities.SetActivatableAbilityManager",
        0xa005,
        {
            fields: [
                {
                    name: "unknownArray1",
                    type: "array",
                    fields: [
                        { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                        {
                            name: "unknownData1",
                            type: "schema",
                            fields: [
                                { name: "unknownQword1", type: "uint64", defaultValue: "0" },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword2", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                        { name: "unknownByte1", type: "uint8", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["Abilities.SetVehicleActivatableAbilityManager", 0xa006, { fields: [] }],
    ["Abilities.SetAbilityTimerManager", 0xa007, { fields: [] }],
    ["Abilities.AddAbilityTimer", 0xa008, { fields: [] }],
    ["Abilities.RemoveAbilityTimer", 0xa009, { fields: [] }],
    ["Abilities.UpdateAbilityTimer", 0xa00a, { fields: [] }],
    ["Abilities.SetAbilityLockTimer", 0xa00b, { fields: [] }],
    ["Abilities.ActivateAbility", 0xa00c, { fields: [] }],
    ["Abilities.VehicleActivateAbility", 0xa00d, { fields: [] }],
    ["Abilities.DeactivateAbility", 0xa00e, { fields: [] }],
    ["Abilities.VehicleDeactivateAbility", 0xa00f, { fields: [] }],
    ["Abilities.ActivateAbilityFailed", 0xa010, { fields: [] }],
    ["Abilities.VehicleActivateAbilityFailed", 0xa011, { fields: [] }],
    ["Abilities.ClearAbilityLineManager", 0xa012, { fields: [] }],
    ["Abilities.SetAbilityLineManager", 0xa013, { fields: [] }],
    ["Abilities.SetProfileAbilityLineMembers", 0xa014, { fields: [] }],
    ["Abilities.SetProfileAbilityLineMember", 0xa015, { fields: [] }],
    ["Abilities.RemoveProfileAbilityLineMember", 0xa016, { fields: [] }],
    ["Abilities.SetVehicleAbilityLineMembers", 0xa017, { fields: [] }],
    ["Abilities.SetVehicleAbilityLineMember", 0xa018, { fields: [] }],
    ["Abilities.RemoveVehicleAbilityLineMember", 0xa019, { fields: [] }],
    ["Abilities.SetFacilityAbilityLineMembers", 0xa01a, { fields: [] }],
    ["Abilities.SetFacilityAbilityLineMember", 0xa01b, { fields: [] }],
    ["Abilities.RemoveFacilityAbilityLineMember", 0xa01c, { fields: [] }],
    ["Abilities.SetEmpireAbilityLineMembers", 0xa01d, { fields: [] }],
    ["Abilities.SetEmpireAbilityLineMember", 0xa01e, { fields: [] }],
    ["Abilities.RemoveEmpireAbilityLineMember", 0xa01f, { fields: [] }],
    [
        "Abilities.SetLoadoutAbilities",
        0xa020,
        {
            fields: [
                {
                    name: "abilities",
                    type: "array",
                    fields: [
                        { name: "abilitySlotId", type: "uint32", defaultValue: 0 },
                        {
                            name: "abilityData",
                            type: "schema",
                            fields: [
                                { name: "abilitySlotId", type: "uint32", defaultValue: 0 },
                                { name: "abilityId", type: "uint32", defaultValue: 0 },
                                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                                { name: "guid1", type: "uint64", defaultValue: "0" },
                                { name: "guid2", type: "uint64", defaultValue: "0" },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
    ["Abilities.AddLoadoutAbility", 0xa021, { fields: [] }],
    ["Abilities.RemoveLoadoutAbility", 0xa022, { fields: [] }],
    ["Abilities.SetImplantAbilities", 0xa023, { fields: [] }],
    ["Abilities.AddImplantAbility", 0xa024, { fields: [] }],
    ["Abilities.RemoveImplantAbility", 0xa025, { fields: [] }],
    ["Abilities.SetPersistentAbilities", 0xa026, { fields: [] }],
    ["Abilities.AddPersistentAbility", 0xa027, { fields: [] }],
    ["Abilities.RemovePersistentAbility", 0xa028, { fields: [] }],
    ["Abilities.SetProfileRankAbilities", 0xa029, { fields: [] }],
    ["Abilities.AddProfileRankAbility", 0xa02a, { fields: [] }],
    ["Abilities.RemoveProfileRankAbility", 0xa02b, { fields: [] }],
    ["Deployable.Place", 0xa101, { fields: [] }],
    ["Deployable.Remove", 0xa102, { fields: [] }],
    ["Deployable.Pickup", 0xa103, { fields: [] }],
    ["Deployable.ActionResponse", 0xa104, { fields: [] }],
    [
        "Security",
        0xa2,
        {
            fields: [{ name: "code", type: "uint32", defaultValue: 0 }],
        },
    ],
    [
        "MapRegion.GlobalData",
        0xa301,
        {
            fields: [
                { name: "unknown1", type: "float", defaultValue: 0.0 },
                { name: "unknown2", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    [
        "MapRegion.Data",
        0xa302,
        {
            fields: [
                { name: "unknown1", type: "float", defaultValue: 0.0 },
                { name: "unknown2", type: "uint32", defaultValue: 0 },
                {
                    name: "regions",
                    type: "array",
                    fields: [
                        { name: "regionId", type: "uint32", defaultValue: 0 },
                        { name: "regionId2", type: "uint32", defaultValue: 0 },
                        { name: "nameId", type: "uint32", defaultValue: 0 },
                        { name: "facilityId", type: "uint32", defaultValue: 0 },
                        { name: "facilityType", type: "uint8", defaultValue: 0 },
                        { name: "currencyId", type: "uint8", defaultValue: 0 },
                        { name: "ownerFactionId", type: "uint8", defaultValue: 0 },
                        {
                            name: "hexes",
                            type: "array",
                            fields: [
                                { name: "x", type: "int32" },
                                { name: "y", type: "int32" },
                                { name: "type", type: "uint32", defaultValue: 0 },
                            ],
                        },
                        { name: "flags", type: "uint8", defaultValue: 0 },
                        { name: "unknown4", type: "array", elementType: "uint8" },
                        { name: "unknown5", type: "array", elementType: "uint8" },
                        { name: "unknown6", type: "array", elementType: "uint8" },
                        { name: "connectionFacilityId", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["MapRegion.ExternalData", 0xa303, { fields: [] }],
    ["MapRegion.Update", 0xa304, { fields: [] }],
    ["MapRegion.UpdateAll", 0xa305, { fields: [] }],
    [
        "MapRegion.MapOutOfBounds",
        0xa306,
        {
            fields: [
                { name: "characterId", type: "uint64", defaultValue: "0" },
                { name: "unknownDword1", type: "uint32", defaultValue: 0 },
                { name: "unknownByte2", type: "uint8", defaultValue: 0 },
            ],
        },
    ],
    ["MapRegion.Population", 0xa307, { fields: [] }],
    [
        "MapRegion.RequestContinentData",
        0xa308,
        {
            fields: [{ name: "zoneId", type: "uint32", defaultValue: 0 }],
        },
    ],
    ["MapRegion.InfoRequest", 0xa309, { fields: [] }],
    ["MapRegion.InfoReply", 0xa30a, { fields: [] }],
    ["MapRegion.ExternalFacilityData", 0xa30b, { fields: [] }],
    ["MapRegion.ExternalFacilityUpdate", 0xa30c, { fields: [] }],
    ["MapRegion.ExternalFacilityUpdateAll", 0xa30d, { fields: [] }],
    ["MapRegion.ExternalFacilityEmpireScoreUpdate", 0xa30e, { fields: [] }],
    ["MapRegion.NextTick", 0xa30f, { fields: [] }],
    ["MapRegion.HexActivityUpdate", 0xa310, { fields: [] }],
    ["MapRegion.ConquerFactionUpdate", 0xa311, { fields: [] }],
    ["Hud", 0xa4, { fields: [] }],
    ["ClientPcData.SetSpeechPack", 0xa501, { fields: [] }],
    [
        "ClientPcData.SpeechPackList",
        0xa503,
        {
            fields: [
                {
                    name: "speechPacks",
                    type: "array",
                    fields: [{ name: "speechPackId", type: "uint32", defaultValue: 0 }],
                },
            ],
        },
    ],
    ["AcquireTimer", 0xa6, { fields: [] }],
    ["PlayerUpdateGuildTag", 0xa7, { fields: [] }],
    ["Warpgate.ActivateTerminal", 0xa801, { fields: [] }],
    ["Warpgate.ZoneRequest", 0xa802, { fields: [] }],
    ["Warpgate.PostQueueNotify", 0xa803, { fields: [] }],
    ["Warpgate.QueueForZone", 0xa804, { fields: [] }],
    ["Warpgate.CancelQueue", 0xa805, { fields: [] }],
    ["Warpgate.WarpToQueuedZone", 0xa806, { fields: [] }],
    ["Warpgate.WarpToSocialZone", 0xa807, { fields: [] }],
    ["LoginQueueStatus", 0xa9, { fields: [] }],
    [
        "ServerPopulationInfo",
        0xaa,
        {
            fields: [
                {
                    name: "population",
                    type: "array",
                    elementtype: "uint16",
                    defaultValue: 0,
                },
                { name: "populationPercent", type: "array", elementType: "uint8" },
                { name: "populationBuff", type: "array", elementType: "uint8" },
            ],
        },
    ],
    [
        "GetServerPopulationInfo",
        0xab,
        {
            fields: [],
        },
    ],
    ["PlayerUpdate.VehicleCollision", 0xac, { fields: [] }],
    [
        "PlayerUpdate.Stop",
        0xad,
        {
            fields: [
                {
                    name: "unknownUint",
                    type: "custom",
                    parser: readUnsignedIntWith2bitLengthValue,
                    packer: packUnsignedIntWith2bitLengthValue,
                },
            ],
        },
    ],
    [
        "Currency.SetCurrencyDiscount",
        0xae01,
        {
            fields: [
                { name: "currencyId", type: "uint32", defaultValue: 0 },
                { name: "discount", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    ["Currency.SetCurrencyRateTier", 0xae02, { fields: [] }],
    ["Items.LoadItemRentalDefinitionManager", 0xaf01, { fields: [] }],
    ["Items.SetItemTimerManager", 0xaf02, { fields: [] }],
    ["Items.SetItemLockTimer", 0xaf03, { fields: [] }],
    ["Items.SetItemTimers", 0xaf04, { fields: [] }],
    ["Items.SetItemTrialLockTimer", 0xaf05, { fields: [] }],
    ["Items.SetItemTrialTimers", 0xaf06, { fields: [] }],
    ["Items.AddItemTrialTimer", 0xaf07, { fields: [] }],
    ["Items.RemoveItemTrialTimer", 0xaf08, { fields: [] }],
    ["Items.ExpireItemTrialTimer", 0xaf09, { fields: [] }],
    ["Items.UpdateItemTrialTimer", 0xaf0a, { fields: [] }],
    ["Items.SetItemRentalTimers", 0xaf0b, { fields: [] }],
    ["Items.AddItemRentalTimer", 0xaf0c, { fields: [] }],
    ["Items.RemoveItemRentalTimer", 0xaf0d, { fields: [] }],
    ["Items.ExpireItemRentalTimer", 0xaf0e, { fields: [] }],
    ["Items.SetAccountItemManager", 0xaf0f, { fields: [] }],
    ["Items.AddAccountItem", 0xaf10, { fields: [] }],
    ["Items.RemoveAccountItem", 0xaf11, { fields: [] }],
    ["Items.UpdateAccountItem", 0xaf12, { fields: [] }],
    ["Items.RequestAddItemTimer", 0xaf13, { fields: [] }],
    ["Items.RequestTrialItem", 0xaf14, { fields: [] }],
    ["Items.RequestRentalItem", 0xaf15, { fields: [] }],
    ["Items.RequestUseItem", 0xaf16, { fields: [] }],
    ["Items.RequestUseAccountItem", 0xaf17, { fields: [] }],
    ["PlayerUpdate.AttachObject", 0xb0, { fields: [] }],
    ["PlayerUpdate.DetachObject", 0xb1, { fields: [] }],
    [
        "ClientSettings",
        0xb2,
        {
            fields: [
                { name: "helpUrl", type: "string", defaultValue: "" },
                { name: "shopUrl", type: "string", defaultValue: "" },
                { name: "shop2Url", type: "string", defaultValue: "" },
            ],
        },
    ],
    [
        "RewardBuffInfo",
        0xb3,
        {
            fields: [
                { name: "unknownFloat1", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat2", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat3", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat4", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat5", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat6", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat7", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat8", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat9", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat10", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat11", type: "float", defaultValue: 0.0 },
                { name: "unknownFloat12", type: "float", defaultValue: 0.0 },
            ],
        },
    ],
    [
        "GetRewardBuffInfo",
        0xb4,
        {
            fields: [],
        },
    ],
    ["Cais", 0xb5, { fields: [] }],
    [
        "ZoneSetting.Data",
        0xb601,
        {
            fields: [
                {
                    name: "settings",
                    type: "array",
                    fields: [
                        { name: "hash", type: "uint32", defaultValue: 0 },
                        { name: "unknown1", type: "uint32", defaultValue: 0 },
                        { name: "unknown2", type: "uint32", defaultValue: 0 },
                        { name: "value", type: "uint32", defaultValue: 0 },
                        { name: "settingType", type: "uint32", defaultValue: 0 },
                    ],
                },
            ],
        },
    ],
    ["RequestPromoEligibilityUpdate", 0xb7, { fields: [] }],
    ["PromoEligibilityReply", 0xb8, { fields: [] }],
    ["MetaGameEvent.StartWarning", 0xb901, { fields: [] }],
    ["MetaGameEvent.Start", 0xb902, { fields: [] }],
    ["MetaGameEvent.Update", 0xb903, { fields: [] }],
    ["MetaGameEvent.CompleteDominating", 0xb904, { fields: [] }],
    ["MetaGameEvent.CompleteStandard", 0xb905, { fields: [] }],
    ["MetaGameEvent.CompleteCancel", 0xb906, { fields: [] }],
    ["MetaGameEvent.ExperienceBonusUpdate", 0xb907, { fields: [] }],
    ["MetaGameEvent.ClearExperienceBonus", 0xb908, { fields: [] }],
    ["RequestWalletTopupUpdate", 0xba, { fields: [] }],
    ["RequestStationCashActivePromoUpdate", 0xbb, { fields: [] }],
    ["CharacterSlot", 0xbc, { fields: [] }],
    ["Operation.RequestCreate", 0xbf01, { fields: [] }],
    ["Operation.RequestDestroy", 0xbf02, { fields: [] }],
    ["Operation.RequestJoin", 0xbf03, { fields: [] }],
    ["Operation.RequestJoinByName", 0xbf04, { fields: [] }],
    ["Operation.RequestLeave", 0xbf05, { fields: [] }],
    ["Operation.ClientJoined", 0xbf06, { fields: [] }],
    ["Operation.ClientLeft", 0xbf07, { fields: [] }],
    ["Operation.BecomeListener", 0xbf08, { fields: [] }],
    ["Operation.AvailableData", 0xbf09, { fields: [] }],
    ["Operation.Created", 0xbf0a, { fields: [] }],
    ["Operation.Destroyed", 0xbf0b, { fields: [] }],
    [
        "Operation.ClientClearMissions",
        0xbf0c,
        {
            fields: [],
        },
    ],
    ["Operation.InstanceAreaUpdate", 0xbf0d, { fields: [] }],
    ["Operation.ClientInArea", 0xbf0e, { fields: [] }],
    ["Operation.InstanceLocationUpdate", 0xbf0f, { fields: [] }],
    ["Operation.GroupOperationListRequest", 0xbf10, { fields: [] }],
    ["Operation.GroupOperationListReply", 0xbf11, { fields: [] }],
    ["Operation.GroupOperationSelect", 0xbf12, { fields: [] }],
    [
        "WordFilter.Data",
        0xc001,
        {
            fields: [{ name: "wordFilterData", type: "byteswithlength" }],
        },
    ],
    ["StaticFacilityInfo.Request", 0xc101, { fields: [] }],
    ["StaticFacilityInfo.Reply", 0xc102, { fields: [] }],
    [
        "StaticFacilityInfo.AllZones",
        0xc103,
        {
            fields: [
                {
                    name: "facilities",
                    type: "array",
                    fields: [
                        { name: "zoneId", type: "uint32", defaultValue: 0 },
                        { name: "facilityId", type: "uint32", defaultValue: 0 },
                        { name: "nameId", type: "uint32", defaultValue: 0 },
                        { name: "facilityType", type: "uint8", defaultValue: 0 },
                        { name: "locationX", type: "float", defaultValue: 0.0 },
                        { name: "locationY", type: "float", defaultValue: 0.0 },
                        { name: "locationZ", type: "float", defaultValue: 0.0 },
                    ],
                },
            ],
        },
    ],
    ["StaticFacilityInfo.ReplyWarpgate", 0xc104, { fields: [] }],
    ["StaticFacilityInfo.AllWarpgateRespawns", 0xc105, { fields: [] }],
    ["ProxiedPlayer", 0xc2, { fields: [] }],
    ["Resist", 0xc3, { fields: [] }],
    ["InGamePurchasing", 0xc4, { fields: [] }],
    ["BusinessEnvironments", 0xc5, { fields: [] }],
    ["EmpireScore", 0xc6, { fields: [] }],
    [
        "CharacterSelectSessionRequest",
        0xc7,
        {
            fields: [],
        },
    ],
    [
        "CharacterSelectSessionResponse",
        0xc8,
        {
            fields: [
                { name: "status", type: "uint8", defaultValue: 0 },
                { name: "sessionId", type: "string", defaultValue: "" },
            ],
        },
    ],
    ["Stats", 0xc9, { fields: [] }],
    ["Resource", 0xca, { fields: [] }],
    ["Construction", 0xcc, { fields: [] }],
    ["SkyChanged", 0xcd, { fields: [] }],
    ["NavGen", 0xce, { fields: [] }],
    ["Locks", 0xcf, { fields: [] }],
    ["Ragdoll", 0xd0, { fields: [] }],
];
var packetTypes = {}, packetDescriptors = {};
PacketTable.build(packets, packetTypes, packetDescriptors);
exports.PacketTypes = packetTypes;
exports.Packets = packetDescriptors;
