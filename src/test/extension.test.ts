import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		const exists = commands.includes('extension.extractFileStructure');
		assert.strictEqual(exists, true, 'Command is not registered');
	});
});
