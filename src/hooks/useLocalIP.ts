import { useState, useEffect } from "react";

// Tries to find the local IP address using WebRTC.
// Useful for showing users what IP to type on their phone.
export function useLocalIP() {
  const [ip, setIp] = useState<string>("192.168.1.X");

  useEffect(() => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("");
    pc.createOffer().then((offer) => pc.setLocalDescription(offer));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const match = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(event.candidate.candidate);
        if (match && match[1] !== "127.0.0.1") {
          setIp(match[1]);
          pc.close();
        }
      }
    };
  }, []);

  return ip;
}
