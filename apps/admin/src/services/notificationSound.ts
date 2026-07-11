import { Audio } from 'expo-av';

// Self-contained two-tone "ding-dong" chime (~0.35s, 8kHz/8-bit mono WAV) —
// embedded as a data URI so there's no bundled asset file to manage, and no
// external download at build/runtime.
const CHIME_DATA_URI =
  'data:audio/wav;base64,UklGRhQLAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YfAKAACAgYOEgn13dHd/iZCRiHpsZmx8kJ6ekHliWGB3laqtmnlZSlNxmba7pXtSPEVpmsHKsX9MLjZgmsvZv4VIIiZVmdPozY1FFhdIldr33JZECwc7j9z+5p9JDQQ1h9b966dREAMvgND8765YFAIpeMr78rZgGQEjcMT49r1oHgEeaL32+MRwIwEZYLby+8p4KQIUWK7v/NCALwMQUafr/daHNQQNSZ/m/tyPOwcJQpfh/+GXQgkHO4/c/uafSQ0ENYfW/eunURADL4DQ/O+uWBQCKXjK+/K2YBkBI3DE+Pa9aB4BHmi99vjEcCMBGWC28vvKeCkCFFiu7/zQfy8DEFGn6/3WhzUEDUmf5v7cjzsHCUKX4f/hl0IJBzuP3P7mn0kNBDWH1v3rp1EQAy9/0PzvrlgUAil4yvvytmAZASNwxPj2vWgeAR5ovfb4xHAjARlgtvL7yngpAhRYru/80IAvAxBRp+v91oc1BA1Jn+b+3I87BwlCl+H/4ZdCCQc7j9z+5p9JDQQ1h9b966dREAMvgND8765YFAIpeMr78rZgGQEjcMT49r1oHgEeaL32+MRwIwEZYLby+8p4KQIUWK7v/NB/LwMQUafr/daHNQQNSZ/m/tyPOwcJQpfh/+GXQgkHO4/c/uafSQ0ENYfW/eunURADL4DQ/O+uWBQCKXjK+/K2YBkBI3DE+Pa9aB4BHmi99vjEcCMBGWC28vvKeCkCFFiu7/zQfy8DEFGn6/3WhzUEDUmf5v7cjzsHCUKX4f/hl0IJBzuP3P7mn0kNBDWH1v3rp1EQAy9/0PzvrlgUAil4yvvytmAZASNwxPj2vWgeAR5ovfb4xHAjARlgtvL7yngpAhRYru/80H8vAxBRp+v91oc1BA1Jn+b+3I87BwlCl+H/4ZdCCQc7j9z+5p9JDQQ1h9b966dREAMvf9D8765YFAIpeMr78rZgGQEjcMT49r1oHgEeaL32+MRwIwEZYLby+8p4KQIUWK7v/NB/LwMQUafr/daHNQQNSZ/m/tyPOwcJQpfh/+GXQgkHO4/c/uafSQ0ENYfW/eunURADL4DQ/O+uWBQCKXjK+/K2YBkBI3DE+Pa9aB4BHmi99vjEcCMBGWC28vvKeCkCFFiu7/zQfy8DEFGn6/3WhzUEDUmf5v7cjzsHCUKX4f/hl0IJBzuP3P7mn0kNBDWH1v3rp1EQAy+A0PzvrlgUAil4yvvytmAZASNwxPj2vWgeAR5ovfb4xHAjARlgtvL7yngpAhRYru/80H8vAxBRp+v91oc1BQ5Kn+T72Y8+DA9Fltz325ZHExFBjtPy3JxQGhM+hsvs3KFYIRc8gMPm26ZgKRo6ebvg2qpnMB45c7Pa2K1uOCM5bqvU1a90Pyg5aqTN0rF6Ri06Zp3Gz7J/TTM7Y5fAy7OEVDg9YZG5xrOIWj5AX4yzwrKMYERDXoetvbGPZkpHXYOnuK+Ra1BKXYChsqyScFZPXnybraqTdFtTX3qWqKaTeGFYYXiSoqOTe2ZdZHeOnZ+SfmpiZneKmJuRf29naneHk5aPgXNsbXeEjpGMgndwcXiCio2Jgnp1dXqBhoiGgX16enyAgoOCgH9+fn+AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAfnx+g4eGfnRzfIuSi3hpa3+WnYxvXWaFo6WJY1JlkLCqglVIaJ29rHdFQW+tyKpoNj57vtKjVig+itDXmEMcRJ3i2YguE06z8tZ0GQ5ey//MXQkTc939uUgDIYnq96Q1ATGg9e2OJAJEtfzgeBYIWMj+0GILEW7Z/b5NBB2E6PipOQEtm/PwkycBP7D6430ZBlTE/tRnDQ5p1v7CUQUaf+X6rj0BKZbx8pgrATur+eaCHAVPwP7YbA8MZNL+xlYHF3vi+7JBAiaR7vSdLwE3p/fphx8DSrv923ESCl/O/spbCBV23vy3RgIijOz2ojMBM6L27IwiAka3/N52FQhbyv7OXwoScdv9u0oDH4fp96c3AS+d9O6RJgJBsvviexcHVsb+0mQMD2zY/sBPBRyC5vmrOwErmPLxlikBPa765YAaBVHC/tZpDg1n1P7EVAYZfeP6sD8BJ5Pw85stATmp+OiEHQRNvv3ZbhELYtD+yFgIFnjg/LVEAiSO7fWgMQE1pPfqiSEDSLn93XMTCV3M/8xdCRNz3f25SAMhier3pDUBMaD17Y4kAkS1/OB4FghYyP7QYgsRbtn9vk0EHYTo+Kk5AS2b8/CTJwE/sPrjfRkGVMT+1GcNDmnW/sJRBRp/5fquPQEplvHymCsBO6v55oIcBU/A/thsDwxk0v7GVgcXe+L7skECJpHu9J0vATen9+mHHwNKu/3bcRIKX87+ylsIFXbe/LdGAiKM7PaiMwEzovbsjCICRrf83nYVCFvK/s5fChJx2/27SgMfh+n3pzcBL5307pEmAkGy++J7FwdWxv7SZAwPbNj+wE8FHILm+as7ASuY8vGWKQE9rvrlgBoFUcL+1mkODWfU/sRUBhl94/qwPwEnk/Dzmy0BOan46IQdBE2+/dluEQti0P7IWAgWeOD8tUQCJI7t9aAxATWk9+qJIQNIuf3dcxMJXcz/zF0JE3Pd/blIAyGJ6vekNQExoPXtjiQCRLX84HgWCFjI/tBiCxFu2f2+TQQdhOj4qTkBLZvz8JMnAT+w+uN9GQZUxP7UZw0Oadb+wlEFGn/l+q49ASmW8fKYKwE7q/nmghwFT8D+2GwPDGTS/sZWBxd74vuyQQImke70nS8BN6f36YcfA0q7/dtxEgpfzv7KWwgVdt78t0YCIozs9qIzATOi9uyMIgJGt/zedhUIW8r+zl8KEnHb/btKAx+H6fenNwEvnfTukSYCQbL74nsXB1bG/tJkDA9s2P7ATwUcgub5qzsBK5jy8ZYpAT2u+uWAGgVRwv7WaQ4NZ9T+xFQGGX3j+rA/ASeT8PObLQE5qfjohB0ETb792W4RC2LQ/shYCBZ44Py1RAIkju31oDEBNaT36okhA0i5/d1zEwldzP/MXQkTc939uUgDIYnq96Q1ATGg9e2OJAJEtfzgeBYIWMj+0GILEW7Z/b5NBB2E6PipOQEtm/PwkycBP7D6430ZBlTE/tRnDQ5p1v7CUQUaf+X6rj0BKZbx8pgrATur+eaCHAVPwP7YbA8MZNL+xlYHF3vi+7JBAiaR7vSdLwE3p/fphx8DSrv923ESCl/O/spbCBV23vy3RgIijOz2ojMBM6L27IwiAka3/N52FQhbyv7OXwoScdv9u0oDH4fp96c3AS+d9O6RJgJBsvviexcHVsb+0mQMD2zY/sBPBRyC5vmrOwErmPLxlikBPa765YAaBVHC/tZpDg1n1P7EVAYZfeP6sD8BJ5Pw85stATmp+OiEHQRNvv3ZbhELYtD+yFgIFnjg/LVEAiSO7fWgMQE1pPfqiSEDSLn93XMTCV3M/8xdCRNz3f25SAMhier3pDUBMaD17Y4kAkS1/OB4FghYyP7QYgsRbtn9vk0EHYTo+Kk5AS2b8/CTJwE/sPrjfRkGVMT+1GcNDmnW/sJRBRp/5fquPQEplvHymCsBO6v55oIcBU/A/thsDwxk0v7GVgcXe+L7skECJpHu9J0vATen9+mHHwNKu/3bcRIKX87+ylsIFXbe/LdGAiKM7PaiMwEzovbsjCICRrf83nYVCFvK/s5fChJx2/27SgMfh+n3pzcBL5307pEmAkGy++J7FwdWxv7SZAwPbNj+wE8FHILm+as7ASuY8vGWKQE9rvrlgBoGUsH81GoREGfS+sJVCx193/WuQwgtkunrmTMKPqbv34QmD1G48dBwHBhlx/DAXRYjedTrrUwUMYzd45s9FUGe49mIMRlSr+bMdSggZL3lvWQiKnbJ4axUHzaH0tucRx9EmNfRizwjU6faxnozKWO02rlqLTFzvterXCo8g8fSnFAqSJLMyo1GLVafz8B+PjJkq8+0cDg5crXNqGM2QoC8yJtYNU2NwcGOTzdZmMS5gUg8ZaPEr3VDQnGrwqVqQUp9sr6ZYEBTiLa5jlhCXJK5soNSRmebual5TktxorigbUxRe6i0l2dLWYWssI1hTWGNrqqEXFBqlK6jfFhUcpqtm3RWWXqfqpRuVmCCoqaMaFhmiaOhhWVabY6jnH5iXnSTopZ4YWJ6lqCQc2FngJiciHBibIWZmIRtZXKJmZR/bGh3jJePe2trcS5MVwFdVsxlZ4W6dTFAP5NoSQiKAAqbTFmuo6mMKSk4';

let currentSound: Audio.Sound | null = null;

export async function playNewOrderChime() {
  try {
    // Only one chime at a time — if several orders land in quick succession,
    // don't stack overlapping playback.
    if (currentSound) {
      await currentSound.unloadAsync();
      currentSound = null;
    }

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync({ uri: CHIME_DATA_URI });
    currentSound = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
        if (currentSound === sound) currentSound = null;
      }
    });

    await sound.playAsync();
  } catch (err) {
    console.warn('[NOTIFICATION SOUND] Failed to play new-order chime', err);
  }
}
