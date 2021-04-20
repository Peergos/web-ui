from setuptools import setup

def readme():
    with open('README.md') as f:
        return f.read()

setup(name='peergos-webui-browser-test',
        version='0.1',
        description='Browser tests for the peergos web-app.',
        long_description=readme(),
        url='http://github.com/Peergos/web-ui',
        author='Chris Boddy',
        author_email='chris@<NO_SPAM>boddy.im',
        license='MIT',
        install_requires=[
            'attrs==16.2.0',
            #'pkg-resources==0.0.0',
            'py==1.10.0',
            'pytest==3.0.4',
            'selenium==3.0.1',
            ],
        zip_safe=False)
