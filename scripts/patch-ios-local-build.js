#!/usr/bin/env node
// Локальная сборка iOS на этом Mac (Xcode 27, путь проекта с пробелом
// "afkaf mvp"). `expo prebuild` создаёт папку ios/ заново и стирает ручные
// правки, которые понадобились для сентябрьской сборки. Этот скрипт возвращает
// их — запускать ПОСЛЕ `expo prebuild --no-install` и ДО `pod install`:
//
//   APP_VARIANT=dev node scripts/patch-ios-local-build.js
//
// Что делает (повторный запуск безопасен — уже внесённое не дублируется):
//   1. ios/Podfile, post_install: поднимает deployment target всех подов до
//      таргета приложения (15.1) — SDK из Xcode 27 не собирает поды с более
//      старым таргетом.
//   2. ios/Podfile, post_install: чинит скрипты EXConstants / EXUpdates, которые
//      ломаются на пробеле в пути проекта.
//   3. ios/.xcode.env.local: NODE_BINARY — абсолютный путь к node, чтобы
//      скрипты сборки Xcode нашли его вне терминала.
//   4. ios/<проект>.xcodeproj, фаза «Bundle React Native code and images»:
//      путь к react-native-xcode.sh берётся в кавычки. Без них shell режет путь
//      по пробелу и сборка падает («/Users/…/afkaf: No such file or directory»).
//      Эту правку НЕ надо повторять через pod install — она в проекте приложения.
//
// Ничего не собирает и ничего не ставит.

const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', 'ios');
const podfilePath = path.join(iosDir, 'Podfile');
const MARKER = '# afkaf local build patch';

if (!fs.existsSync(podfilePath)) {
  console.error('ios/Podfile не найден — сначала выполни `npx expo prebuild --platform ios --no-install`.');
  process.exit(1);
}

const PATCH = `
    ${MARKER} (scripts/patch-ios-local-build.js)
    # Xcode 27 SDK supports iOS 15.0+; raise older pod targets to the app target.
    app_deployment_target = podfile_properties['ios.deploymentTarget'] || '15.1'
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        pod_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if pod_target && Gem::Version.new(pod_target) < Gem::Version.new(app_deployment_target)
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = app_deployment_target
        end
      end
    end

    # The project path contains a space ("afkaf mvp"): the EXConstants/EXUpdates phases run
    # \`bash -l -c "$PODS_TARGET_SRCROOT/..."\` (word-split) and their scripts do an unquoted
    # \`basename $PROJECT_DIR\` (silently exits). Quote the script path, pass PROJECT_ROOT
    # explicitly and give the scripts a space-free PROJECT_DIR for the basename check.
    {
      'EXConstants' => 'get-app-config-ios.sh',
      'EXUpdates' => 'create-updates-resources-ios.sh',
    }.each do |target_name, script_name|
      target = installer.pods_project.targets.find { |t| t.name == target_name }
      next unless target
      target.shell_script_build_phases.each do |phase|
        next unless phase.shell_script.include?(script_name)
        phase.shell_script = <<~SH
          export PROJECT_ROOT="\${PODS_ROOT}/../.."
          PROJECT_DIR="Pods" bash -l "\${PODS_TARGET_SRCROOT}/../scripts/#{script_name}"
        SH
      end
    end
`;

let podfile = fs.readFileSync(podfilePath, 'utf8');

if (podfile.includes(MARKER)) {
  console.log('Podfile: правки уже на месте.');
} else {
  // Вставляем сразу после вызова react_native_post_install(...) внутри post_install.
  const anchor = /react_native_post_install\([\s\S]*?\n {4}\)\n/;
  const match = podfile.match(anchor);
  if (!match) {
    console.error(
      'Podfile: не нашёл вызов react_native_post_install(...) — шаблон Expo изменился. ' +
        'Правки НЕ внесены; сверь ios/Podfile со scripts/patch-ios-local-build.js вручную.',
    );
    process.exit(1);
  }
  const at = match.index + match[0].length;
  podfile = podfile.slice(0, at) + PATCH + podfile.slice(at);
  fs.writeFileSync(podfilePath, podfile);
  console.log('Podfile: правки внесены (deployment target подов, пробел в пути).');
}

// Фаза «Bundle React Native code and images» в проекте приложения. Шаблон Expo
// запускает скрипт через обратные кавычки без внешних кавычек:
//   `"$NODE_BINARY" --print "…/scripts/react-native-xcode.sh"`
// — результат (путь с пробелом) режется на два слова. Заменяем на "$(…)".
// Строки ниже — в том виде, как они записаны в project.pbxproj (с \" внутри).
const XCODE_SH =
  `\\"$NODE_BINARY\\" --print \\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\"`;
const BUNDLE_PHASE_BROKEN = '`' + XCODE_SH + '`';
const BUNDLE_PHASE_FIXED = '\\"$(' + XCODE_SH + ')\\"';

const xcodeprojs = fs.readdirSync(iosDir).filter((name) => name.endsWith('.xcodeproj'));
if (xcodeprojs.length === 0) {
  console.error('ios/*.xcodeproj не найден — prebuild не завершился?');
  process.exit(1);
}
for (const name of xcodeprojs) {
  const pbxPath = path.join(iosDir, name, 'project.pbxproj');
  const pbx = fs.readFileSync(pbxPath, 'utf8');
  if (pbx.includes(BUNDLE_PHASE_FIXED)) {
    console.log(`${name}: фаза Bundle React Native — кавычки уже на месте.`);
  } else if (pbx.includes(BUNDLE_PHASE_BROKEN)) {
    fs.writeFileSync(pbxPath, pbx.split(BUNDLE_PHASE_BROKEN).join(BUNDLE_PHASE_FIXED));
    console.log(`${name}: фаза Bundle React Native — путь взят в кавычки.`);
  } else {
    console.error(
      `${name}: не нашёл строку запуска react-native-xcode.sh — шаблон Expo изменился. ` +
        'Правка НЕ внесена; сверь фазу «Bundle React Native code and images» вручную.',
    );
    process.exit(1);
  }
}

// NODE_BINARY: стабильная ссылка Homebrew (как в сентябрьской сборке), если она
// есть; иначе — тот node, которым запущен этот скрипт. Путь из process.execPath
// у Homebrew содержит номер версии и ломается после `brew upgrade node`.
const HOMEBREW_NODE = '/opt/homebrew/bin/node';
const nodeBinary = fs.existsSync(HOMEBREW_NODE) ? HOMEBREW_NODE : process.execPath;
const envLocalPath = path.join(iosDir, '.xcode.env.local');
// APP_VARIANT: если скрипт запущен с ним (APP_VARIANT=dev node scripts/…),
// кладём его туда же — скрипты сборки Xcode читают конфиг приложения заново и
// без переменной вшили бы обычный конфиг вместо dev-варианта.
const variant = process.env.APP_VARIANT;
const envLine =
  `export NODE_BINARY=${nodeBinary}\n` +
  (variant && /^[a-z0-9_-]+$/i.test(variant) ? `export APP_VARIANT=${variant}\n` : '');
const current = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
if (current === envLine) {
  console.log('.xcode.env.local: уже на месте.');
} else {
  fs.writeFileSync(envLocalPath, envLine);
  console.log(`.xcode.env.local: ${envLine.trim().replace(/\n/g, '; ')}`);
}
