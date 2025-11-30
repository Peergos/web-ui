
# See https://www.graalvm.org/latest/reference-manual/native-image/metadata/AutomaticMetadataCollection/
export PATH=/home/ian/web-ui/native-build/graalvm-community-openjdk-25.0.1+8.1/bin:$PATH

java -agentlib:native-image-agent=config-output-dir=genconfig -jar Peergos.jar daemon -PEERGOS_PATH /home/ian/web-ui/native-build/.peergos -log-to-console true

# modify generated resource-config.json to include webroot/.*
