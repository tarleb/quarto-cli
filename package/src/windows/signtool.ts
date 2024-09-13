import { info } from "../../../src/deno_ral/log.ts";
import { join } from "../../../src/deno_ral/path.ts";
import {  getEnv } from "../util/utils.ts";

import { runCmd } from "../util/cmd.ts";

const kSignToolPath = getEnv("SIGNTOOL_PATH", "")

export interface SigningDescriptor {
  file: string; // The file that is signed
  desc?: string; // Description for this file
}

export async function signtool(
  descriptors: SigningDescriptor[],
  fingerprint: string,
  workingDir: string,
) {

  // skip nicely if not signing tool
  let signToolBin: "signtool.exe";
  if (kSignToolPath) {
    signToolBin = join(kSignToolPath, "signtool.exe");
  } else {
    info("No signing tool available, skipping signing");
    info("Set SIGNTOOL_PATH where `signtool.exe` is to enable signing.");
    return;
  }
  
  try {
    // signtool.exe sign /sha1 "%SM_CLIENT_CERT_FINGERPRINT%" /tr http://timestamp.digicert.com /td SHA256 /fd SHA256 "%INSTALLER_FILE%"
    const signArgs = ["sign", "/debug", "/sha1", fingerprint, "/tr", "http://timestamp.digicert.com", "/td", "SHA256", "/fd", "SHA256"];
    // signtool.exe verify /v /pa "%INSTALLER_FILE%"
    const verifyArgs= ["verify", "/v", "/pa"];
    for (const descriptor of descriptors) {
      const file = descriptor.file;
      const desc = descriptor.desc;
      const fileArgs = desc ? ["/d", desc, file] : [file];

      info(`> Signing ${file}`);
      const signCommand = new Deno.Command(signToolBin, { args: [...signArgs, file]});
      const result = signCommand.outputSync();
      if (!result.success) {
        console.log("CODE: ", result.code);
        console.log("STDOUT")
        console.log(new TextDecoder().decode(result.stdout));
        console.log("STDERR")
        console.log(new TextDecoder().decode(result.stderr));
        console.error(`Failed to sign ${file}`);
        return Promise.reject();
      } else {
        console.log(new TextDecoder().decode(result.stdout));
      }
      info(`> Verify ${file}`);
      const verifyCommand= new Deno.Command(signToolBin, { args: [...verifyArgs, file]});
      const result2 = verifyCommand.outputSync();
      if (!result2.success) {
        console.error(`Failed to sign ${file}`);
        console.error(new TextDecoder().decode(result2.stderr));
        return Promise.reject();
      } else {
        console.log(new TextDecoder().decode(result2.stdout));
      }
      info(`> ${file} signed successfully`);
    }
  } catch (error) {
    console.error("An error occurred during signing:", error);
    return Promise.reject();
  }
}
