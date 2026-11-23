using System.Reflection;
using System.Runtime.InteropServices;
using Valve.VR;

if (args.Length != 1 || !File.Exists(args[0])) return 2;
NativeLibrary.SetDllImportResolver(Assembly.GetExecutingAssembly(), (name, _, _) =>
    name == "openvr_api" ? NativeLibrary.Load(args[0]) : IntPtr.Zero);
var error = EVRInitError.None;
var vr = OpenVR.Init(ref error, EVRApplicationType.VRApplication_Background);
if (vr == null || error != EVRInitError.None) return 3;
try
{
    var poses = new TrackedDevicePose_t[OpenVR.k_unMaxTrackedDeviceCount];
    bool Tracked(ETrackedControllerRole role)
    {
        uint index = vr.GetTrackedDeviceIndexForControllerRole(role);
        return index < poses.Length && poses[index].bDeviceIsConnected && poses[index].bPoseIsValid;
    }
    for (int i = 0; i < 480; i++)
    {
        vr.GetDeviceToAbsoluteTrackingPose(ETrackingUniverseOrigin.TrackingUniverseStanding, 0, poses);
        if (poses[0].bPoseIsValid && Tracked(ETrackedControllerRole.LeftHand)
            && Tracked(ETrackedControllerRole.RightHand)) return 0;
        Thread.Sleep(250);
    }
    return 4;
}
finally
{
    OpenVR.Shutdown();
}
