Summary: peergos
Name: peergos
Version: 1.0.0
Release: 1
License: AGPL
Vendor: Peergos Ltd.

%if "xhttps://peergos.org" != "x"
URL: https://peergos.org
%endif

%if "x/opt" != "x"
Prefix: /opt
%endif

Provides: peergos

%if "x" != "x"
Group: 
%endif

Autoprov: 0
Autoreq: 0
%if "xxdg-utils" != "x" || "x" != "x"
Requires: xdg-utils 
%endif

#comment line below to enable effective jar compression
#it could easily get your package size from 40 to 15Mb but
#build time will substantially increase and it may require unpack200/system java to install
%define __jar_repack %{nil}

# on RHEL we got unwanted improved debugging enhancements
%define _build_id_links none

%define package_filelist %{_builddir}/%{name}.files
%define app_filelist %{_builddir}/%{name}.app.files
%define filesystem_filelist %{_builddir}/%{name}.filesystem.files

%define default_filesystem / /opt /usr /usr/bin /usr/lib /usr/local /usr/local/bin /usr/local/lib

%description
The Peergos server and web interface.

%global __os_install_post %{nil}

%prep

%build

%install
rm -rf %{buildroot}
install -d -m 755 %{buildroot}/opt/peergos
cp -r %{_sourcedir}/opt/peergos/* %{buildroot}/opt/peergos
ln -s /opt/peergos/bin/peergos /usr/bin
if [ "$(echo %{_sourcedir}/lib/systemd/system/*.service)" != '%{_sourcedir}/lib/systemd/system/*.service' ]; then
  install -d -m 755 %{buildroot}/lib/systemd/system
  cp %{_sourcedir}/lib/systemd/system/*.service %{buildroot}/lib/systemd/system
fi
%if "x" != "x"
  %define license_install_file %{_defaultlicensedir}/%{name}-%{version}/%{basename:}
  install -d -m 755 "%{buildroot}%{dirname:%{license_install_file}}"
  install -m 644 "" "%{buildroot}%{license_install_file}"
%endif
(cd %{buildroot} && find . -path ./lib/systemd -prune -o -type d -print) | sed -e 's/^\.//' -e '/^$/d' | sort > %{app_filelist}
{ rpm -ql filesystem || echo %{default_filesystem}; } | sort > %{filesystem_filelist}
comm -23 %{app_filelist} %{filesystem_filelist} > %{package_filelist}
sed -i -e 's/.*/%dir "&"/' %{package_filelist}
(cd %{buildroot} && find . -not -type d) | sed -e 's/^\.//' -e 's/.*/"&"/' >> %{package_filelist}
%if "x" != "x"
  sed -i -e 's|"%{license_install_file}"||' -e '/^$/d' %{package_filelist}
%endif

%files -f %{package_filelist}
%if "x" != "x"
  %license "%{license_install_file}"
%endif

%post
package_type=rpm

xdg-desktop-menu install /opt/peergos/lib/peergos-peergos.desktop


%pre
package_type=rpm

if [ "$1" = 2 ]; then
  true; 
fi

%preun
package_type=rpm


xdg-desktop-menu uninstall /opt/peergos/lib/peergos-peergos.desktop


%clean
