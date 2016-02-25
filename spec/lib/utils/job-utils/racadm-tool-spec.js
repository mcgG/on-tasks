// Copyright 2016, EMC, Inc.
/* jshint node: true */

'use strict';

describe("racadm-tool", function() {
    var instance, parser;

    var mockChildProcessFactory = function() {
        function MockChildProcess(command, args, env) {
            this.command = command;
            this.args = args;
            this.env = env;
        }
        MockChildProcess.prototype.run = function () {
            var self = this;
            var args = self.args;
            var subCommandIndex = args.join(' ').indexOf('get BIOS'),
                pwdIndex = args.join(' ').indexOf('-p admin'),
                hostIndex = args.join(' ').indexOf('-r ');

            //local racadm command case
            if (hostIndex === -1){
                return Promise.resolve({
                    stdout: 'Get BIOS Correctly'
                });
            }

            //remote racadm command case
            if( subCommandIndex !== -1) {
                    if (pwdIndex !== -1) {
                        return Promise.resolve({
                            stdout: 'Get BIOS Correctly'
                        });
                    } else {
                        return Promise.reject({
                            stderr: 'ERROR: Login failed - invalid username or password\n'
                        });
                    }
            }
        };
        return MockChildProcess;
    };

    before('racadm tool before', function() {
        helper.setupInjector([
            helper.require('/lib/utils/job-utils/racadm-tool'),
            helper.require('/lib/utils/job-utils/racadm-parser'),
            helper.di.simpleWrapper(mockChildProcessFactory(), 'ChildProcess')
        ]);
        instance = helper.injector.get('JobUtils.RacadmTool');
        parser = helper.injector.get('JobUtils.RacadmCommandParser');

    });

    describe('instance', function(){

        before(function() {
            this.sandbox = sinon.sandbox.create();
        });

        describe('runCommand', function(){
            afterEach('runCommand after', function() {
                this.sandbox.restore();
            });

            it('should get console standard out if succeed', function() {
                return instance.runCommand('192.168.188.103','admin', 'admin', 'get BIOS')
                    .then(function(ret){
                        expect(ret).to.be.equals('Get BIOS Correctly');
                    });
            });

            it('should get console standard error if failed', function() {
                return instance.runCommand('192.168.188.103','admin', 'admi', 'get BIOS')
                    .should.be.rejected;
            });

            it('should get console standard out if tried local command', function() {
                return instance.runCommand('','admin', 'admin', 'get BIOS')
                    .then(function(ret){
                        expect(ret).to.be.equals('Get BIOS Correctly');
                    });
            });

        });

        describe('enableIpmi', function(){
            afterEach('runCommand after', function() {
                this.sandbox.restore();
            });

            it('enableIpmi exists', function() {
                should.exist(instance.enableIpmi);
            });
            it('enableIpmi is a function', function() {
                expect(instance.enableIpmi).is.a('function');
            });

            it('should enable IPMI', function(){
                this.sandbox.stub(instance, 'runCommand').resolves();
                return instance.enableIpmi('any','any','any')
                    .then(function(){
                        expect(instance.runCommand).to.have.been.calledOnce;
                    });
            });
        });

        describe('disableIpmi', function(){
            afterEach('runCommand after', function() {
                this.sandbox.restore();
            });

            it('disableIpmi exists', function() {
                should.exist(instance.disableIpmi);
            });
            it('disableIpmi is a function', function() {
                expect(instance.disableIpmi).is.a('function');
            });

            it('should disable IPMI', function(){
                this.sandbox.stub(instance, 'runCommand').resolves();
                return instance.disableIpmi('any','any','any')
                    .then(function(){
                        expect(instance.runCommand).to.have.been.calledOnce;
                    });
            });
        });

        describe('getJobStatus', function(){
            before('setBiosConfig before', function() {
                this.jobId = 'JID_927008261880';
            });
            afterEach('setBiosConfig after', function() {
                this.sandbox.restore();
            });

            it('should get job status', function() {
                var self = this ;
                this.sandbox.stub(parser, 'getJobStatus').returns('somevalue');
                this.sandbox.stub(instance, 'runCommand').resolves();
                return instance.getJobStatus('192.168.188.103','admin', 'admin', self.jobId)
                    .then(function(ret){
                        expect(instance.runCommand).to.have.been.calledOnce;
                        expect(parser.getJobStatus).to.have.been.calledOnce;
                        expect(ret).to.equals('somevalue');
                    });
            });

            it('should throw errors', function(done) {
                var self = this ;
                this.sandbox.stub(parser, 'getJobStatus').returns();
                this.sandbox.stub(instance, 'runCommand').rejects({error: "Error happened"});
                return instance.getJobStatus('192.168.188.103','admin', 'admin', self.jobId)
                    .then(function() {
                        done(new Error("Expected getJobStatus to throw errors"));
                    })
                    .catch(function(err){
                        expect(instance.runCommand).to.have.been.calledOnce;
                        expect(parser.getJobStatus).to.not.have.been.called;
                        expect(err.error).to.equals("Error happened");
                        done();
                    });
            });

        });

        describe('waitJobDone', function(){
            var getJobStatusStub, waitJobDoneSpy;
            beforeEach('waitJobDone before', function() {
                getJobStatusStub = this.sandbox.stub(instance, 'getJobStatus');
                waitJobDoneSpy = this.sandbox.spy(instance, 'waitJobDone');
                this.jobId = 'JID_927008261880';
                this.jobStatus = {
                    jobId: 'JID_927008261880',
                    jobName: 'Configure: Import system configuration XML file',
                    status: 'Completed',
                    startTime: 'Not Applicable',
                    expirationTime: 'Not Applicable',
                    message:
                        'SYS053: Successfully imported and applied system configuration XML file.',
                    percentComplete: '100'
                };
            });
            afterEach('waitJobDone after', function() {
                this.sandbox.restore();
            });

            it('should get job completion status correctly', function() {
                var self = this ;
                getJobStatusStub.resolves(self.jobStatus);
                return instance.waitJobDone('192.168.188.103','admin', 'admin', self.jobId, 0, 100)
                    .then(function(ret){
                        expect(instance.getJobStatus).to.have.been.calledOnce;
                        expect(ret).to.deep.equals(self.jobStatus);
                    });
            });

            it('should throw job failed errors', function(done) {
                var self = this ;
                self.jobStatus.status = 'Failed';
                getJobStatusStub.resolves(self.jobStatus);
                return instance.waitJobDone('192.168.188.103','admin', 'admin', self.jobId, 0, 100)
                    .then(function() {
                        done(new Error("Expected getJobStatus to throw errors"));
                    })
                    .catch(function(err){
                        expect(err).to.deep.equals(
                            new Error('Job Failed during process, jobStatus: ' +
                            JSON.stringify(self.jobStatus))
                        );
                        expect(instance.getJobStatus).to.be.calledOnce;
                        done();
                    });
            });

            it('should get job completion status correctly after iteration', function() {
                var self = this,
                    runningJobStatus = {
                        jobId: 'JID_927008261880',
                        jobName: 'Configure: Import system configuration XML file',
                        status: 'Running',
                        startTime: 'Not Applicable',
                        expirationTime: 'Not Applicable',
                        message:
                            'SYS053: Successfully imported and applied system ' +
                            'configuration XML file.',
                        percentComplete: '100'
                    };

                getJobStatusStub.resolves(runningJobStatus)
                    .onCall(3).resolves(self.jobStatus);

                return instance.waitJobDone('192.168.188.103','admin', 'admin', self.jobId, 0, 0.1)
                    .then(function() {
                        expect(instance.waitJobDone.callCount).to.equal(4);
                        expect(instance.getJobStatus.callCount).to.equal(4);
                    });
            });

            it('should call itself until timeout', function(done) {
                var self = this ;
                self.jobStatus.status = 'Running';
                getJobStatusStub.resolves(self.jobStatus);
                return instance.waitJobDone('192.168.188.103','admin', 'admin', self.jobId, 0, 0)
                    .then(function() {
                        done(new Error("Expected waitJobDone to fail"));
                    })
                    .catch(function(err) {
                        expect(instance.waitJobDone.callCount).to.equal(11);
                        expect(instance.getJobStatus.callCount).to.equal(11);
                        expect(err).to.deep.equals(
                            new Error('Job Timeout, jobStatus: ' +
                            JSON.stringify(self.jobStatus))
                        );
                        done();
                    });
            });

            it('should report error if status is undefined', function(done) {
                var self = this ;
                self.jobStatus.status = 'Anything';
                getJobStatusStub.resolves(self.jobStatus);
                return instance.waitJobDone('192.168.188.103','admin', 'admin', self.jobId, 0, 0)
                    .then(function() {
                        done(new Error("Expected waitJobDone to fail"));
                    })
                    .catch(function(err) {
                        expect(instance.waitJobDone.callCount).to.equal(1);
                        expect(instance.getJobStatus.callCount).to.equal(1);
                        expect(err).to.deep.equals(
                            new Error('Job status is incorrect, jobStatus: ' +
                            JSON.stringify(self.jobStatus))
                        );
                        done();
                    });
            });

        });

        describe('run async commands', function(){
            var runCommandStub, getJobIdStub, waitJobDoneStub;
            beforeEach('run async commands before', function() {
                runCommandStub = this.sandbox.stub(instance, 'runCommand');
                getJobIdStub = this.sandbox.stub(parser, 'getJobId');
                waitJobDoneStub = this.sandbox.stub(instance, 'waitJobDone');
            });

            afterEach('run async commands after', function() {
                this.sandbox.restore();
            });

            it('should run commands and get completion status', function(){
                var command = "set -f bios.xml -t xml -u " +
                        "onrack -p onrack -l //192.168.188.113/share";
                runCommandStub.resolves();
                getJobIdStub.returns();
                waitJobDoneStub.resolves();
                return instance.runAsynCommands('192.168.188.113','admin', 'admin',
                    command, 0, 1000)
                    .then(function(){
                        expect(instance.runCommand).to.be.calledWith('192.168.188.113',
                            'admin', 'admin', command);
                        expect(parser.getJobId).to.have.been.calledOnce;
                        expect(instance.waitJobDone).to.have.been.called;
                    });
            });

            it('should report errors if promise failure', function(){
                var command = "set -f bios.xml -t xml -u " +
                    "onrack -p onrack -l //192.168.188.113/share";
                runCommandStub.resolves();
                getJobIdStub.returns();
                waitJobDoneStub.rejects({error: "Error happend"});
                return instance.runAsynCommands('192.168.188.113','admin', 'admin',
                    command, 0, 1000).should.be.rejectedWith({error: "Error happend"});
            });

        });

        describe('setBiosConfig', function(){
            var runAsyncCommandsStub, getPathFilenameStub;
            beforeEach('setBiosConfig before', function() {
                runAsyncCommandsStub = this.sandbox.stub(instance, 'runAsynCommands');
                getPathFilenameStub = this.sandbox.stub(parser, 'getPathFilename');
                this.cifsConfig = {
                    user: 'onrack',
                    password: 'onrack',
                    filePath: '//192.168.188.113/share/bios.xml'
                };
                this.fileInfo = {
                    name: 'bios.xml',
                    path: '//192.168.188.113/share',
                    style: 'remote'
                };
            });

            afterEach('setBiosConfig after', function() {
                this.sandbox.restore();
            });

            it('should set BIOS configure via remote file', function(){
                var self = this,
                    command = "set -f bios.xml -t xml -u " +
                        "onrack -p onrack -l //192.168.188.113/share";
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.resolves();
                return instance.setBiosConfig('192.168.188.113','admin', 'admin', self.cifsConfig)
                    .then(function(){
                        expect(instance.runAsynCommands).to.be.calledWith('192.168.188.113',
                            'admin', 'admin', command, 0, 1000);
                        expect(parser.getPathFilename).to.have.been.calledOnce;
                    });
            });

            it('should set BIOS configure via local file', function(){
                var self = this,
                    command = "set -f /home/share/bios.xml -t xml";
                self.fileInfo.path = '/home/share';
                self.fileInfo.style = 'local';
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.resolves();
                return instance.setBiosConfig('192.168.188.113','admin', 'admin', self.cifsConfig)
                    .then(function(){
                        expect(instance.runAsynCommands).to.be.calledWith('192.168.188.113',
                            'admin', 'admin', command, 0, 1000);
                        expect(parser.getPathFilename).to.have.been.calledOnce;
                    });
            });

            it('should failed if get promise failure', function(){
                var self = this;
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.rejects({error: "Error happend"});
                return instance.setBiosConfig('192.168.188.103','admin', 'admin', self.cifsConfig).
                    should.be.rejectedWith({error: "Error happend"});
            });

            it('should failed if get invalid xml file path', function(){
                var self = this;
                self.fileInfo.style = '';
                getPathFilenameStub.returns(self.fileInfo);
                expect(function(){
                    return instance.setBiosConfig('192.168.188.103','admin', 'admin',
                        self.cifsConfig);
                }).to.throw(Error, 'XML file path is invalid');
            });

        });

        describe('updateIdracImage', function(){
            var runAsyncCommandsStub, getPathFilenameStub;
            beforeEach('updateIdracImage before', function() {
                runAsyncCommandsStub = this.sandbox.stub(instance, 'runAsynCommands');
                getPathFilenameStub = this.sandbox.stub(parser, 'getPathFilename');
                this.cifsConfig = {
                    user: 'onrack',
                    password: 'onrack',
                    filePath: '//192.168.188.113/share/firmimg.d7'
                };
                this.fileInfo = {
                    name: 'firmimg.d7',
                    path: '//192.168.188.113/share',
                    style: 'remote'
                };
            });

            afterEach('updateIdracImage after', function() {
                this.sandbox.restore();
            });

            it('should update idrac image via remote file', function(){
                var self = this,
                    command = "update -f firmimg.d7 -u onrack -p onrack -l //192.168.188.113/share";
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.resolves();
                return instance.updateIdracImage('192.168.188.113','admin', 'admin',
                    self.cifsConfig)
                    .then(function(){
                        expect(instance.runAsynCommands).to.be.calledWith('192.168.188.113',
                            'admin', 'admin', command, 0, 1000);
                        expect(parser.getPathFilename).to.have.been.calledOnce;
                    });
            });

            it('should set BIOS configure via local file', function(){
                var self = this,
                    command = "update -f /home/share/firmimg.d7";
                self.fileInfo.path = '/home/share';
                self.fileInfo.style = 'local';
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.resolves();
                return instance.updateIdracImage('192.168.188.113','admin', 'admin',
                    self.cifsConfig)
                    .then(function(){
                        expect(instance.runAsynCommands).to.be.calledWith('192.168.188.113',
                            'admin', 'admin', command, 0, 1000);
                        expect(parser.getPathFilename).to.have.been.calledOnce;
                    });
            });

            it('should failed if get promise failure', function(){
                var self = this;
                getPathFilenameStub.returns(self.fileInfo);
                runAsyncCommandsStub.rejects({error: "Error happend"});
                return instance.updateIdracImage('192.168.188.103','admin', 'admin',
                    self.cifsConfig).should.be.rejectedWith({error: "Error happend"});
            });

            it('should throw error if image file is not in .d7', function(){
                var self = this;
                self.fileInfo.name = 'firmimg';
                getPathFilenameStub.returns(self.fileInfo);
                expect( function() {
                    return instance.updateIdracImage('192.168.188.103', 'admin', 'admin',
                        self.cifsConfig);
                }).throw(Error, 'iDRAC image format is not supported');
            });

            it('should failed if get invalid image file path', function(){
                var self = this;
                self.fileInfo.style = '';
                getPathFilenameStub.returns(self.fileInfo);
                expect( function() {
                    return instance.updateIdracImage('192.168.188.103', 'admin', 'admin',
                        self.cifsConfig);
                }).throw(Error, 'iDRAC image file path is invalid');
            });

        });

    });
});