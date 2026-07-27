{pkgs}: {
  deps = [
    pkgs.gnumake
    pkgs.gcc
    pkgs.python3
    pkgs.util-linux
    pkgs.pkg-config
    pkgs.pixman
    pkgs.librsvg
    pkgs.giflib
    pkgs.libjpeg
    pkgs.pango
    pkgs.cairo
    pkgs.libuuid
    pkgs.unzip
  ];
}
